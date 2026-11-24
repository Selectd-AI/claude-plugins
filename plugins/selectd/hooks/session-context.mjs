#!/usr/bin/env node
// SessionStart hook: prints the Selectd company security context for Claude Code, or nothing. Always exits 0.
import { dataDir, hookOutput, keyStore, sessionText } from "./lib.mjs";

const dir = dataDir();
try {
  const text = await sessionText({ store: keyStore({ dir }), dir, log: (m) => process.stderr.write(`selectd: ${m}\n`) });
  if (text) process.stdout.write(hookOutput(text));
} catch {
  // fail-open: never block or break the session start
}
process.exit(0);
