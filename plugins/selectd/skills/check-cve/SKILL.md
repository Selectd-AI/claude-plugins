---
name: check-cve
description: Asks Selectd whether a CVE affects the user's company and presents the answer with its evidence. Use when the user asks "are we affected by CVE-…", "does CVE-… hit us", "what about <CVE ID>", or mentions a CVE identifier in a security context.
---

# Check a CVE with Selectd

## Call

Call the MCP tool **`check_cve`** with `{ "cve": "CVE-YYYY-NNNN" }` (upper case, one CVE per call).
If the tool is missing or the server asks for authentication, run the **setup** skill first.

## Present the answer

Selectd answers with one of three verdicts. Keep the wording precise:

- **affected** – name the affected product(s) and version(s) Selectd found, the affected range, and where the version came from (for example "stated via your agent" or "confirmed"). Point to the open case in Selectd if one is given.
- **not affected (in the checked scope)** – say exactly that and name the scope Selectd checked. Never widen it to "you are not affected".
- **unknown** – give the reason and the open question Selectd needs answered (for example a missing version). Suggest how the user can answer it in Selectd.

If the answer contains a `dayside` entry, add: "Public Selectd briefing on this CVE (general guidance, not specific to your company): <title> – <url>".

## Rules

- **Never say "not affected" without the evidence Selectd returned.** No case found is not an all-clear.
- Do not guess versions, do not add CVSS or exploit claims that Selectd did not return.
- A version marked "stated via your agent" was sent by a customer agent and is not confirmed; say so.
- On "rate limited", wait the given time; on "unavailable", say that Selectd could not be reached and do not answer from memory.
