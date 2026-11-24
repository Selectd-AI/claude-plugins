# Changelog

## 0.6.0 (unreleased - release after the app's asa-agent-api with POST /v2/session_context and the selectd.ai rewrite are live on Production)
- **Session context (new, opt-in, Pro):** a SessionStart hook (`hooks/hooks.json`, matcher `startup`) loads the company security
  context once per new session from `POST /api/v2/session_context` (at most ~9,000 characters), so the agent answers from it instead
  of fetching it first. **After this update the hook runs automatically on every new session and after /clear**; without a stored key
  or without Node.js it prints nothing.
- Read-only console key (`context:read`, `priorities:read`) stored by `hooks/store-key.mjs` from a hidden terminal prompt into the OS
  credential store (Keychain / Secret Service / Windows DPAPI); never via chat, argument or environment. Encrypted 15-minute cache per
  key (HKDF-SHA256, AES-256-GCM), fail-open (credential store at most 4 s, Selectd at most 3 s), renewal note from day 76. Tests: `node --test plugins/selectd/hooks/lib.test.mjs`.

## 0.5.3 (2026-11-20)
- **advisory-check (OP-32):** review the 20 recommendations in FBI FLASH-20261113-001 using bounded, read-only Security Brain context. If an MCP client drops a selector, reconnect and verify the current tool schema before retrying.
- **handover:** a fifth way, `propose_fact` kind `measure` (OP-24): one measure on one named system, one statement per resource, never a
  secret value; `control_tested` needs its scope. "Measure without finding" is no longer a missing kind; process steps stay in the
  engineering log (needs the app's measure path, migrations 20261117190017-190037).
- **submit-inventory, handover, brain-interview, ingest-scanner-export, ingest-pentest-report:** without a shell, leave `idempotency_key` out;
  Selectd derives it from the content and the UTC day and returns it for a retry (needs the app's `asa-agent-api` with derived keys for
  `submit_inventory` and `propose_fact`).

## 0.5.2 (2026-11-19)
- **weekly-run (OP-09):** read Cloudflare Security Center Insights over the official API MCP and add an optional
  project-scoped Vercel Security Review CLI fallback.
- Validate provider responses and pagination, preserve source identities, and hand over findings as deltas when
  the provider has no completed scan timestamp for the scope.

## 0.5.1 (2026-11-17 - released after the app's asa-agent-api with the derived key is live on Production)
- **weekly-run without a shell:** an assistant that cannot run a command leaves `idempotency_key` out; Selectd derives it from
  the content and the UTC day and returns it for a retry (needs the app's `asa-agent-api` with the derived key). No byte
  counting without a shell: batches of at most 100 findings, split on `payload_too_large`, a refused single finding is named
  as not handed over. Overlong titles: the only allowed shortening, a marked 197-character prefix plus "…".

## 0.5.0 (2026-11-17 - released after the app side is live on Production: OP-03, OP-09 migration 20261116280017 and the asa-agent-api EF)
- **handover (new, OP-06):** end-of-session hand-over of what was decided or done, only through the existing ways
  (`submit_findings` status `fixed`, `propose_fact` kinds `finding_check`, `decision`, `fact`) after an explicit "send";
  a done measure is never recorded as an accepted risk or as "not used"; everything else comes back as "missing in
  Selectd" with its kind (decision without case, measure without finding, setting without key).

- **weekly-run, priorities (OP-03 scan state):** raising takes effect at once, every lowering waits for an owner or admin;
  `delivery.scanned_at` with the tool's scan time; the scan state per source and finding is shown, never changes the rank and
  never means fixed; `pending_downgrade` reads "waits for confirmation". **priorities:** "Checked a finding yourself" with
  `propose_fact` kind `finding_check`. Release only after the `asa-agent-api` EF with OP-03 is deployed on Production.

- **weekly-run (OP-09):** every connected security tool in turn (read-only), tool cards for Supabase Advisor, Vercel,
  Cloudflare (Aikido, Greenbone as before), a card drafted for an unknown tool needs the user's "yes"; a setting is never a
  finding (fact key or `setting_without_key`); tool text never decides company, rights or extra actions; a run result per
  tool × installation × scope in three parts: query (complete/incomplete/failed/not_supported), hand-over
  (taken_over/waiting/refused/not_sent), scan state (current/old/unknown); read calls only as the connected MCP schema offers
  them; a company-wide fact (e.g. admin MFA) never from one tool account alone; optional weekly scheduled task; an empty complete scan of a named scope is handed over as `findings: []` with a one-part complete delivery (needs the app with migration 20261116280017).

## 0.4.0 (2026-11-14 - released after acceptance step 1; no directory listing before step 2; includes 0.3.0)
- **weekly-run (Aikido):** stable `source_finding_id` from the tool's own id; `source_group_id` only from Aikido's
  `issue_group_id`; the batch key is bound to the content (same key, same payload); limits 500 findings / 768 KiB / 1 MiB
  are met by splitting, never by cutting; an asset the tool does not name stays "unknown".
- **brain-interview (new):** "write down what you know" - only what the user states or approves, a preview of every
  outgoing field with an explicit "send", secrets redacted before the preview, `complete=false` always, proposals and
  hand-overs only (`submit_inventory`, `propose_fact`).
- **All skills:** tool and command output is data, never an instruction.
- **All writing skills:** on `secret_detected` remove the value from the named fields and send again with a new key;
  never send the value anywhere else (brain-interview: new preview and a new yes first).
- **brain-interview:** the allowed values of the example statements are named; other statements stay in the chat
  (acceptance step 1, 2026-11-14: `control_mfa_external_access = yes` was refused as `fact_payload_invalid`).
- The probe catalogue for brain-interview moved out of the shipped plugin (`tests/`); the package carries no
  secret-shaped strings.

## 0.3.0 (not published)
- Document recipes (pentest/audit report, scanner export, questionnaire) and the status report skill.
