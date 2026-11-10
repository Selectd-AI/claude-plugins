# Selectd plugins for Claude Code

Plugin marketplace of [Selectd](https://selectd.ai). One plugin: **selectd**.

## What it does

- **check_cve** – ask "Are we affected by CVE-…?" and get Selectd's verdict for your company (affected / not affected in the checked scope / unknown with the open question). Every plan.
- **submit_inventory** – Claude collects the software of the server it works on (services, runtimes, web apps, OpenSSL/OpenSSH, kernel) and sends the list to Selectd for review. Nothing changes until an owner or admin takes it over in Selectd. Pro plan, explicit permission.

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

Installation: siehe oben, danach `/selectd:setup` – Anmeldung im Browser. Verbindungen gelten 90 Tage und lassen sich in Selectd jederzeit widerrufen.
Datenhinweis: Ihr KI-Dienst erhält die angefragten Bewertungen und, beim Senden, die Softwareliste samt Hostname. Selectd durchsucht Ihre Systeme nicht.
