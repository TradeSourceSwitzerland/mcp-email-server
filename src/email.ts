import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import type { AccountConfig } from './config.js';

type AttachmentInfo = { filename?: string; contentType: string; size: number };

export function withImap<T>(account: AccountConfig, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({ host: account.imap.host, port: account.imap.port, secure: account.imap.secure, auth: { user: account.imap.user, pass: account.imap.password }, logger: false });
  return client.connect().then(async () => {
    try { return await fn(client); } finally { await client.logout().catch(() => undefined); }
  });
}

export async function parseMessage(raw: Buffer | string) {
  const parsed = await simpleParser(raw);
  return {
    subject: parsed.subject ?? '', from: parsed.from?.text ?? '', to: parsed.to?.text ?? '',
    date: parsed.date?.toISOString() ?? null, text: parsed.text ?? '',
    html: parsed.html ? String(parsed.html) : null,
    attachments: parsed.attachments.map((a: AttachmentInfo) => ({ filename: a.filename, contentType: a.contentType, size: a.size }))
  };
}

export function smtp(account: AccountConfig) {
  return nodemailer.createTransport({ host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure, auth: { user: account.smtp.user, pass: account.smtp.password } });
}

function headerValue(value: string) {
  return value.replace(/[\r\n]/g, ' ').trim();
}

export function buildSentMessage({ from, to, cc, subject, text, messageId, date = new Date() }: { from: string; to: string; cc?: string; subject: string; text: string; messageId?: string; date?: Date }) {
  const headers = [
    `From: ${headerValue(from)}`,
    `To: ${headerValue(to)}`,
    cc ? `Cc: ${headerValue(cc)}` : '',
    `Subject: ${headerValue(subject)}`,
    `Date: ${date.toUTCString()}`,
    messageId ? `Message-ID: ${headerValue(messageId)}` : '',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit'
  ].filter(Boolean);
  return Buffer.from(`${headers.join('\r\n')}\r\n\r\n${text}\r\n`, 'utf8');
}

export async function appendSentCopy(account: AccountConfig, message: Buffer) {
  return withImap(account, async (client) => {
    const boxes = await client.list();
    const sent = boxes.find((box) => box.path.toLowerCase() === 'sent' || /sent/i.test(box.specialUse ?? ''));
    if (!sent) throw new Error('Sent mailbox not found');
    const lock = await client.getMailboxLock(sent.path);
    try {
      return await client.append(sent.path, message, ['\\Seen']);
    } finally {
      lock.release();
    }
  });
}
