import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import type { AccountConfig } from './config.js';

export function withImap<T>(account: AccountConfig, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({ host: account.imap.host, port: account.imap.port, secure: account.imap.secure, auth: { user: account.imap.user, pass: account.imap.password }, logger: false });
  return client.connect().then(async () => {
    try { return await fn(client); } finally { await client.logout().catch(() => undefined); }
  });
}

export async function parseMessage(raw: Buffer | string) {
  const parsed = await simpleParser(raw);
  return { subject: parsed.subject ?? '', from: parsed.from?.text ?? '', to: parsed.to?.text ?? '', date: parsed.date?.toISOString() ?? null, text: parsed.text ?? '', html: parsed.html ? String(parsed.html) : null, attachments: parsed.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, size: a.size })) };
}

export function smtp(account: AccountConfig) {
  return nodemailer.createTransport({ host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure, auth: { user: account.smtp.user, pass: account.smtp.password } });
}
