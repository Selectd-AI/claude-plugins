// Selectd session context for Claude Code (SessionStart hook). No dependencies, Node >= 18.
// Security rules: the read-only key (sak_) lives only in the OS credential store and moves between processes only over stdin/stdout,
// never as an argument or environment variable; the local cache is encrypted with a key derived from it (HKDF-SHA256, AES-256-GCM);
// there is no plaintext fallback. Every failure is silent towards the session (fail-open): the hook prints nothing and exits 0.
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ENDPOINT = "https://selectd.ai/api/v2/session_context";
export const KEY_SHAPE = /^sak_[0-9a-f]{64}$/;
export const MAX_CONTEXT_CHARS = 9500; // Claude Code passes hook context whole up to ~10,000 characters (probe 2026-11-24); server cap 9,000
export const CACHE_TTL_MS = 15 * 60 * 1000;
export const STALE_OK_MS = 24 * 60 * 60 * 1000;
export const HTTP_TIMEOUT_MS = 3000;
export const STORE_TIMEOUT_MS = 4000; // measured 2026-11-24 on Windows: DPAPI via PowerShell store 1.75 s, read 0.98 s
export const WARN_AFTER_DAYS = 76; // keys live at most 90 days
const SERVICE = "selectd-session-context";

export const keyId = (key) => createHash("sha256").update(key).digest("hex").slice(0, 16);

export function dataDir(env = process.env, platform = process.platform) {
  if (platform === "win32") return join(env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "selectd");
  return join(env.XDG_CACHE_HOME || join(homedir(), ".cache"), "selectd");
}

// ---- cache: AES-256-GCM, key = HKDF-SHA256(api key, salt, key id); file = iv(12) | tag(16) | ciphertext ----
function cacheKey(apiKey) {
  return Buffer.from(hkdfSync("sha256", Buffer.from(apiKey, "utf8"), Buffer.from("selectd-session-cache-v1"), Buffer.from(keyId(apiKey)), 32));
}
export function encryptCache(apiKey, obj) {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", cacheKey(apiKey), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}
export function decryptCache(apiKey, buf) {
  try {
    const d = createDecipheriv("aes-256-gcm", cacheKey(apiKey), buf.subarray(0, 12)); d.setAuthTag(buf.subarray(12, 28));
    const o = JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8"));
    return o && typeof o.text === "string" && typeof o.fetchedAt === "number" ? o : null;
  } catch { return null; }
}
export const cacheFile = (dir, apiKey) => join(dir, `session-${keyId(apiKey)}.bin`);
export function readCache(dir, apiKey) {
  const f = cacheFile(dir, apiKey);
  try { return existsSync(f) ? decryptCache(apiKey, readFileSync(f)) : null; } catch { return null; }
}
export function writeCache(dir, apiKey, obj) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(cacheFile(dir, apiKey), encryptCache(apiKey, obj), { mode: 0o600 });
}
export function removeCache(dir, apiKey) { try { rmSync(cacheFile(dir, apiKey), { force: true }); } catch { /* nothing to remove */ } }

// ---- key metadata (not secret): when the key was stored, for the expiry note ----
export const metaFile = (dir) => join(dir, "session-key.json");
export function readMeta(dir) { try { return JSON.parse(readFileSync(metaFile(dir), "utf8")); } catch { return null; } }
export function writeMeta(dir, meta) { mkdirSync(dir, { recursive: true, mode: 0o700 }); writeFileSync(metaFile(dir), JSON.stringify(meta), { mode: 0o600 }); }

// ---- OS credential store; the secret only ever crosses process borders on stdin/stdout ----
const PS_STORE = "$s=[Console]::In.ReadToEnd().Trim(); ConvertTo-SecureString $s -AsPlainText -Force | ConvertFrom-SecureString";
const PS_READ = "$b=[Console]::In.ReadToEnd().Trim(); $ss=ConvertTo-SecureString $b; " +
  "[Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss))";
export function keyStore({ platform = process.platform, run = spawnSync, dir = dataDir() } = {}) {
  const ps = (script, input) => run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { input, encoding: "utf8", timeout: STORE_TIMEOUT_MS, windowsHide: true });
  const blob = join(dir, "session-key.dpapi");
  if (platform === "win32") return {
    name: "Windows DPAPI (current user)",
    get() { if (!existsSync(blob)) return null; const r = ps(PS_READ, readFileSync(blob, "utf8")); return r.status === 0 ? String(r.stdout).trim() : null; },
    set(key) { const r = ps(PS_STORE, key); if (r.status !== 0 || !String(r.stdout).trim()) throw new Error("store_failed"); mkdirSync(dir, { recursive: true, mode: 0o700 }); writeFileSync(blob, String(r.stdout).trim(), { mode: 0o600 }); },
    remove() { rmSync(blob, { force: true }); },
  };
  if (platform === "darwin") return {
    name: "macOS Keychain",
    get() { const r = run("security", ["find-generic-password", "-a", "selectd", "-s", SERVICE, "-w"], { encoding: "utf8", timeout: STORE_TIMEOUT_MS }); return r.status === 0 ? String(r.stdout).trim() : null; },
    // security -i reads the command from stdin, so the key never shows up in the process list
    set(key) { const r = run("security", ["-i"], { input: `add-generic-password -U -a selectd -s ${SERVICE} -w ${key}\n`, encoding: "utf8", timeout: STORE_TIMEOUT_MS }); if (r.status !== 0) throw new Error("store_failed"); },
    remove() { run("security", ["delete-generic-password", "-a", "selectd", "-s", SERVICE], { encoding: "utf8", timeout: STORE_TIMEOUT_MS }); },
  };
  return {
    name: "Secret Service (secret-tool)",
    get() { const r = run("secret-tool", ["lookup", "service", SERVICE, "account", "selectd"], { encoding: "utf8", timeout: STORE_TIMEOUT_MS }); return r.status === 0 ? String(r.stdout).trim() : null; },
    set(key) { const r = run("secret-tool", ["store", "--label=Selectd session context key", "service", SERVICE, "account", "selectd"], { input: key, encoding: "utf8", timeout: STORE_TIMEOUT_MS }); if (r.error || r.status !== 0) throw new Error("no_secret_store"); },
    remove() { run("secret-tool", ["clear", "service", SERVICE, "account", "selectd"], { encoding: "utf8", timeout: STORE_TIMEOUT_MS }); },
  };
}

// ---- endpoint call ----
export async function fetchContext(apiKey, etag, { fetchImpl = fetch, url = ENDPOINT, timeoutMs = HTTP_TIMEOUT_MS } = {}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetchImpl(url, { method: "POST", signal: ac.signal, redirect: "error",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...(etag ? { "if-none-match": etag } : {}) }, body: "{}" });
    if (r.status === 304) return { kind: "unchanged" };
    if (r.status === 401) return { kind: "unauthorized" };
    if (r.status !== 200) return { kind: "error", status: r.status };
    const b = await r.json();
    if (b?.status === "not_available") return { kind: "not_available" };
    if (b?.status !== "ok" || typeof b.text !== "string") return { kind: "error", status: 200 };
    return { kind: "ok", text: b.text, etag: typeof b.etag === "string" ? b.etag : null };
  } catch { return { kind: "error", status: 0 }; } finally { clearTimeout(t); }
}

export function expiryNote(meta, now = Date.now()) {
  const at = Date.parse(meta?.storedAt ?? "");
  if (!Number.isFinite(at)) return "";
  const days = Math.floor((now - at) / 86400000);
  return days >= WARN_AFTER_DAYS
    ? `\nNote for the user: the Selectd session key was stored ${days} days ago; keys expire after at most 90 days. Renew it with the Selectd setup skill (section "Session context").`
    : "";
}

/** Decides what the hook prints. Returns the context text or null (print nothing). Never throws. */
export async function sessionText({ store, dir, now = Date.now(), fetchImpl = fetch, url = ENDPOINT, log = () => {} } = {}) {
  let apiKey = null;
  try { apiKey = store.get(); } catch { apiKey = null; }
  if (!apiKey || !KEY_SHAPE.test(apiKey)) return null; // not set up: silent
  const cached = readCache(dir, apiKey);
  const note = expiryNote(readMeta(dir), now);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.text + note;
  const r = await fetchContext(apiKey, cached?.etag ?? null, { fetchImpl, url });
  if (r.kind === "ok") {
    if (r.text.length > MAX_CONTEXT_CHARS) { log("context larger than the hook limit, not shown"); return null; }
    writeCache(dir, apiKey, { text: r.text, etag: r.etag, fetchedAt: now }); return r.text + note;
  }
  if (r.kind === "unchanged" && cached) { writeCache(dir, apiKey, { ...cached, fetchedAt: now }); return cached.text + note; }
  if (r.kind === "unauthorized") { removeCache(dir, apiKey); log("Selectd session key refused (revoked or expired); renew it with the setup skill"); return null; }
  if (r.kind === "not_available") { removeCache(dir, apiKey); return null; }
  log(`Selectd session context unavailable (${r.status ?? "?"})`);
  return cached && now - cached.fetchedAt < STALE_OK_MS ? cached.text + note : null;
}

export const hookOutput = (text) => JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } });
