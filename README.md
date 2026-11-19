# Selectd plugins for Claude Code

Plugin marketplace of [Selectd](https://selectd.ai). One plugin: **selectd**.

## What it does

- **check_cve** – ask "Are we affected by CVE-…?" and get Selectd's verdict for your company (affected / not affected in the checked scope / unknown with the open question). Every plan.
- **submit_inventory** – Claude collects the software of the server it works on (services, runtimes, web apps, OpenSSL/OpenSSH, kernel) and sends the list to Selectd for review. Nothing changes until an owner or admin takes it over in Selectd. Pro plan, explicit permission.
- **Weekly run** (`weekly-run` skill) – Claude fetches the open findings of a security tool connected to it (for example Aikido or Greenbone/OpenVAS), hands them over with `submit_findings` and shows Selectd's weekly priority list (`get_priorities`, `get_finding`). The first hand-over per tool waits for an owner/admin in Selectd. Pro plan, explicit permission.

- **Advisory check** (`advisory-check` skill) - run `/selectd:advisory-check` to assess all 20 recommendations in FBI FLASH-20261113-001. Use a Selectd connection with `context:read`. Copy the body for another assistant or use its request and verdict rules in a REST v2 client. See the [advisory-check recipe](plugins/selectd/skills/advisory-check/SKILL.md).

## Install (Claude Code)

```
/plugin marketplace add selectd-ai/claude-plugins
/plugin install selectd@selectd
/reload-plugins
/selectd:setup
```

`/selectd:setup` opens the Selectd sign-in in your browser. Pick your company (owner/admin) and approve the permissions. Connections last 90 days and can be revoked anytime in Selectd → Settings → Integrations → AI assistants.

Guide: https://selectd.ai/docs/ai-assistants/claude-code

## Data

Your AI service receives the assessments you ask for and, when you send a software list, the list including the host name. Selectd does not search your systems and stores the host name only as a keyed fingerprint.

---

## Deutsch

**check_cve**: „Sind wir von CVE-… betroffen?“ – Selectds Einschätzung für Ihre Firma (alle Tarife).
**submit_inventory**: Claude erfasst die Software des Servers und sendet die Liste zur Prüfung; wirksam erst nach Übernahme durch Owner/Admin in Selectd (Pro, ausdrückliche Freigabe).
**Wochenlauf** (`weekly-run`): Claude holt die offenen Funde eines angebundenen Security-Tools (z. B. Aikido, Greenbone/OpenVAS), übergibt sie mit `submit_findings` und zeigt Selectds Wochenliste (`get_priorities`, `get_finding`); die erste Übergabe je Tool bestätigt ein Owner/Admin in Selectd (Pro, ausdrückliche Freigabe).

**FBI-Prüfliste** (`advisory-check`): Mit `/selectd:advisory-check` die 20 Empfehlungen aus FBI FLASH-20261113-001 prüfen. Benötigt eine Selectd-Verbindung mit `context:read`. Für andere Assistenten den Text des [Prüfrezepts](plugins/selectd/skills/advisory-check/SKILL.md) kopieren. REST-v2-Clients können daraus die Abruf- und Belegregeln übernehmen.

Installation: siehe oben, danach `/selectd:setup` – Anmeldung im Browser. Verbindungen gelten 90 Tage und lassen sich in Selectd jederzeit widerrufen.
Datenhinweis: Ihr KI-Dienst erhält die angefragten Bewertungen und, beim Senden, die Softwareliste samt Hostname. Selectd durchsucht Ihre Systeme nicht.
