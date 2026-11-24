#!/usr/bin/env node
// Stores the read-only Selectd key for the session context in the OS credential store. Run it in your own terminal:
//   node "<plugin>/hooks/store-key.mjs"            asks for the key without echo, checks it once, stores it
//   node "<plugin>/hooks/store-key.mjs" --remove   deletes key, cache and metadata
// The key is never taken from an argument or an environment variable, and never pasted into the chat.
import { dataDir, fetchContext, KEY_SHAPE, keyStore, removeCache, writeMeta, metaFile } from "./lib.mjs";
import { rmSync } from "node:fs";

const dir = dataDir(); const store = keyStore({ dir });

function hiddenPrompt(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) return reject(new Error("run this in an interactive terminal"));
    process.stdout.write(question); input.setRawMode(true); input.resume(); input.setEncoding("utf8");
    let s = "";
    const done = (v, err) => { input.setRawMode(false); input.pause(); input.removeListener("data", on); process.stdout.write("\n"); err ? reject(err) : resolve(v); };
    const on = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") return done(s);
        if (c === String.fromCharCode(3)) return done(null, new Error("cancelled"));
        if (c === "\u007f" || c === "\b") s = s.slice(0, -1); else s += c;
      }
    };
    input.on("data", on);
  });
}

if (process.argv.includes("--remove")) {
  let key = null; try { key = store.get(); } catch { key = null; }
  if (key) removeCache(dir, key);
  try { store.remove(); } catch { /* already gone */ }
  rmSync(metaFile(dir), { force: true });
  process.stdout.write("Selectd session key, cache and metadata removed.\n");
  process.exit(0);
}

try {
  const key = (await hiddenPrompt("Selectd read-only key (sak_..., input hidden): ")).trim();
  if (!KEY_SHAPE.test(key)) throw new Error("this is not a Selectd console key (sak_ followed by 64 hex characters)");
  const check = await fetchContext(key, null, { timeoutMs: 10000 });
  if (check.kind === "unauthorized") throw new Error("Selectd refused the key (revoked, expired or not a console key)");
  if (check.kind === "error") throw new Error(`Selectd could not be reached (status ${check.status}); nothing stored`);
  store.set(key);
  writeMeta(dir, { storedAt: new Date().toISOString() });
  process.stdout.write(`Stored in ${store.name}.${check.kind === "not_available" ? " Note: this company or key has no access to the security context (Pro plan and the permissions context:read, priorities:read)." : ""}\n`);
  process.exit(0);
} catch (e) {
  process.stderr.write(`Not stored: ${e.message}\n`);
  process.exit(1);
}
