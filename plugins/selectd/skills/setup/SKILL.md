---
name: setup
description: Signs the user in to Selectd and verifies the Selectd MCP server. Use after installing the Selectd plugin, when a Selectd tool call fails with "needs authentication" or 401, when the user wants to switch the Selectd company or account, or asks whether Selectd is connected.
---

# Selectd setup

The Selectd MCP server (`selectd`) uses a browser sign-in (OAuth). No token is copied by hand.

## Steps

0. If the user wants to switch company or account, do NOT stop at a working status: an owner or admin first revokes
   this connection in Selectd (Settings → Integrations → AI assistants → Connections); then continue with step 2.
1. Call the MCP tool **`selectd_status`**.
   - If it answers, show the user: company, effective permissions, connection status. Stop here.
   - If the server reports that authentication is needed (401 / "needs authentication"), continue with step 2.
2. Ask the user to sign in: run `/mcp`, select **selectd**, choose **Authenticate**. A browser window opens at selectd.ai.
   - On a machine without a browser: `claude mcp login selectd --no-browser`, open the printed link elsewhere, paste the redirect URL back.
3. In the browser the user signs in to Selectd, picks the company (only companies where they are owner or admin) and approves the permissions:
   - **Read vulnerability assessments** (`check_cve`) – available on every plan.
   - **Send software lists for review** (`submit_inventory`) – only shown and only effective on the Pro plan, never pre-selected.
4. After the user confirms the sign-in, call `selectd_status` again and report the result.

## Status meanings (explain in plain words)

| Status | Meaning |
|---|---|
| connected | Works. Shows which permissions are active. |
| connected – submitting needs Pro | Reading works; sending software lists needs the Selectd Pro plan. |
| connected – submitting blocked by company policy | An admin turned off sending software lists for AI assistants in Selectd. |
| sign in again required | The sign-in was ended (for example after a security check). Repeat step 2. |
| expired (90 days) | Connections last 90 days. Repeat step 2. |
| revoked | An admin removed this connection in Selectd → Settings → Integrations. |

## Rules

- Never ask the user to paste a password or token into the chat.
- To switch company or account: an admin revokes the connection in Selectd (Settings → Integrations → AI assistants → Connections), then repeat step 2.
- Data note: the AI service receives the assessments you ask for and, when you send a software list, the list including the host name. Selectd does not search your systems.
