# MCP Email Server

Secure, self-hostable MCP server for connecting Claude to `info@tradesource.ch` and additional IMAP/SMTP accounts later.

## Enabled mailbox operations

- Read and search emails
- List folders and attachment metadata
- Create drafts in the `Drafts` folder
- Send emails and archive copies in the IMAP `Sent` folder
- Set flags, move messages to folders, and move messages to `Trash` instead of permanently deleting them
- Create mailboxes and download attachments as Base64
- Classify, organize, deduplicate, and extract data from mandate requests
- Record sent-mail metadata in the `Gesendet-Protokoll` IMAP folder

All destructive operations are reversible at the mailbox level: `delete_email` moves a message to the IMAP `Trash` folder and never permanently deletes it. Credentials are read only from environment variables and must never be committed.

## Organization tools

The organization tools use UID-based IMAP operations. `auto_organize` creates and uses `Mandate/Neu`, `Mandate/Antworten`, `Versicherer`, and `Spam-Verdacht`; duplicate mandate requests are moved to `Mandate/Duplikat`. `list_open_mandates` only returns unread mandate requests from the selected mailbox.

## Local setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and fill in the IONOS mailbox credential. Use a newly rotated password or app password; never reuse a password exposed in chat.
3. Install and build:

```bash
npm install
npm run build
npm start
```

The HTTP endpoint listens on `http://127.0.0.1:8787/mcp` by default. Claude.ai requires a publicly reachable HTTPS endpoint, for example `https://mcp.tradesource.ch/mcp`, plus the bearer token configured in `MCP_BEARER_TOKEN`.

For local MCP clients using stdio:

```bash
npm run build && npm run start:stdio
```

## IONOS settings

- IMAP: `imap.ionos.de`, port `993`, SSL/TLS
- SMTP: `smtp.ionos.de`, port `465`, SSL/TLS
- Username: the complete mailbox address

## Adding accounts

Add another numbered `EMAIL_ACCOUNT_N_*` block to `.env`; the account name is selected by each tool's `account` argument.

## Production security

Run behind HTTPS, keep `.env` outside Git, use a long random bearer token, restrict access at the hosting layer where possible, and keep the server read/draft/send-only as configured. Do not expose mailbox credentials to Claude or commit them to this repository.
