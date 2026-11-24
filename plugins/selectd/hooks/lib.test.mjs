// node --test plugins/selectd/hooks/lib.test.mjs  (no network, no real credential store)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cacheFile, decryptCache, encryptCache, expiryNote, hookOutput, keyStore, readCache, sessionText, writeCache, writeMeta, CACHE_TTL_MS, MAX_CONTEXT_CHARS } from "./lib.mjs";

const KEY_A = "sak_" + "a".repeat(64), KEY_B = "sak_" + "b".repeat(64);
const dir = () => mkdtempSync(join(tmpdir(), "selectd-hook-"));
const store = (key) => ({ get: () => key });
const reply = (status, body) => Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
const counter = (fn) => { const f = (...a) => { f.calls.push(a); return fn(...a); }; f.calls = []; return f; };

test("cache is encrypted, authenticated and bound to the key that wrote it", () => {
  const d = dir(); writeCache(d, KEY_A, { text: "SECRET-CONTEXT", etag: '"e"', fetchedAt: 1 });
  const raw = readFileSync(cacheFile(d, KEY_A));
  assert.equal(raw.includes(Buffer.from("SECRET-CONTEXT")), false, "no plaintext on disk");
  assert.equal(readCache(d, KEY_A).text, "SECRET-CONTEXT");
  assert.equal(decryptCache(KEY_B, raw), null, "another key cannot read it");
  const tampered = Buffer.from(raw); tampered[tampered.length - 1] ^= 1;
  assert.equal(decryptCache(KEY_A, tampered), null, "tampering is detected");
  assert.equal(readCache(d, KEY_B), null, "key B has its own file and sees nothing");
});

test("not set up or malformed key: nothing printed, no network", async () => {
  const f = counter(() => reply(200, {}));
  assert.equal(await sessionText({ store: store(null), dir: dir(), fetchImpl: f }), null);
  assert.equal(await sessionText({ store: store("sao_" + "a".repeat(64)), dir: dir(), fetchImpl: f }), null);
  assert.equal(f.calls.length, 0);
});

test("fresh fetch prints the text and caches it; within 15 min no network; after it If-None-Match and 304 reuse", async () => {
  const d = dir(); const f = counter((_u, init) => init.headers["if-none-match"] ? reply(304) : reply(200, { status: "ok", text: "CTX", etag: '"e1"' }));
  assert.equal(await sessionText({ store: store(KEY_A), dir: d, now: 1000, fetchImpl: f }), "CTX");
  assert.equal(await sessionText({ store: store(KEY_A), dir: d, now: 1000 + CACHE_TTL_MS - 1, fetchImpl: f }), "CTX");
  assert.equal(f.calls.length, 1);
  assert.equal(await sessionText({ store: store(KEY_A), dir: d, now: 1000 + CACHE_TTL_MS + 1, fetchImpl: f }), "CTX");
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1][1].headers["if-none-match"], '"e1"');
  assert.equal(f.calls[0][1].headers.authorization, `Bearer ${KEY_A}`); assert.equal(f.calls[0][1].method, "POST");
});

test("401 deletes the cache and prints nothing; not_available prints nothing", async () => {
  const d = dir(); writeCache(d, KEY_A, { text: "OLD", etag: '"e"', fetchedAt: 0 });
  assert.equal(await sessionText({ store: store(KEY_A), dir: d, now: CACHE_TTL_MS * 2, fetchImpl: () => reply(401, { error: "unauthorized" }) }), null);
  assert.equal(readCache(d, KEY_A), null);
  assert.equal(await sessionText({ store: store(KEY_A), dir: dir(), fetchImpl: () => reply(200, { status: "not_available" }) }), null);
});

test("network failure or timeout: stale cache up to 24 h, otherwise nothing; never throws", async () => {
  const d = dir(); writeCache(d, KEY_A, { text: "STALE", etag: null, fetchedAt: 0 });
  const boom = () => Promise.reject(new Error("offline"));
  assert.equal(await sessionText({ store: store(KEY_A), dir: d, now: CACHE_TTL_MS + 5, fetchImpl: boom }), "STALE");
  assert.equal(await sessionText({ store: store(KEY_A), dir: d, now: 25 * 3600 * 1000, fetchImpl: boom }), null);
  const hang = (_u, init) => new Promise((_r, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
  const t0 = Date.now();
  assert.equal(await sessionText({ store: store(KEY_A), dir: dir(), fetchImpl: hang }), null);
  assert.ok(Date.now() - t0 < 4000, "gives up after the 3 s budget");
  assert.equal(await sessionText({ store: { get: () => { throw new Error("store broken"); } }, dir: dir(), fetchImpl: boom }), null);
});

test("context above the hook limit is not printed (Claude Code would move it to a file)", async () => {
  const big = "x".repeat(MAX_CONTEXT_CHARS + 1);
  assert.equal(await sessionText({ store: store(KEY_A), dir: dir(), fetchImpl: () => reply(200, { status: "ok", text: big, etag: null }) }), null);
});

test("expiry note from day 76 after storing, and the hook output is the SessionStart JSON form", async () => {
  const day = 86400000; const stored = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(expiryNote({ storedAt: "2026-01-01T00:00:00Z" }, stored + 75 * day), "");
  assert.match(expiryNote({ storedAt: "2026-01-01T00:00:00Z" }, stored + 80 * day), /stored 80 days ago/);
  const d = dir(); writeMeta(d, { storedAt: "2026-01-01T00:00:00Z" });
  const t = await sessionText({ store: store(KEY_A), dir: d, now: stored + 80 * day, fetchImpl: () => reply(200, { status: "ok", text: "CTX", etag: null }) });
  assert.match(t, /^CTX\nNote for the user/);
  assert.deepEqual(JSON.parse(hookOutput("T")), { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "T" } });
});

test("key store passes the key only on stdin, never as an argument (all three platforms)", () => {
  const calls = []; const run = (cmd, args, opts) => { calls.push({ cmd, args, input: opts?.input }); return { status: 0, stdout: "BLOB" }; };
  const d = dir();
  for (const platform of ["win32", "darwin", "linux"]) keyStore({ platform, run, dir: d }).set(KEY_A);
  for (const c of calls) assert.equal(c.args.some((a) => a.includes(KEY_A)), false, `${c.cmd} got the key as an argument`);
  assert.ok(calls.every((c) => typeof c.input === "string" && c.input.includes(KEY_A)), "key goes over stdin");
  writeFileSync(join(d, "x"), "");
});
