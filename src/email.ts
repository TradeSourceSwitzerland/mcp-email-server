import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import type { AccountConfig } from './config.js';

type AttachmentInfo = { filename?: string; contentType: string; size: number };
export type OutgoingAttachment = { filename: string; contentType?: string; content: Buffer };
export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_TOTAL_BYTES = 18 * 1024 * 1024;

export function decodeAttachments(attachments?: { filename: string; contentType?: string; base64: string }[]): OutgoingAttachment[] | undefined {
  if (!attachments?.length) return undefined;
  if (attachments.length > MAX_ATTACHMENTS) throw new Error(`Too many attachments (max ${MAX_ATTACHMENTS})`);
  const decoded = attachments.map(({ filename, contentType, base64 }) => {
    const normalized = base64.replace(/\s/g, '');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) throw new Error(`Invalid Base64 attachment: ${filename}`);
    return { filename, contentType, content: Buffer.from(normalized, 'base64') };
  });
  const totalBytes = decoded.reduce((sum, attachment) => sum + attachment.content.length, 0);
  if (totalBytes > MAX_ATTACHMENT_TOTAL_BYTES) throw new Error(`Attachments too large: ${(totalBytes / (1024 * 1024)).toFixed(1)}MB exceeds the ${MAX_ATTACHMENT_TOTAL_BYTES / (1024 * 1024)}MB limit`);
  return decoded;
}

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

export async function parseMessageDetails(raw: Buffer | string) {
  const parsed = await simpleParser(raw);
  return parsed;
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

export async function buildSentMessageWithAttachments({ from, to, cc, subject, text, messageId, date = new Date(), attachments }: { from: string; to: string; cc?: string; subject: string; text: string; messageId?: string; date?: Date; attachments?: OutgoingAttachment[] }): Promise<Buffer> {
  if (!attachments?.length) return buildSentMessage({ from, to, cc, subject, text, messageId, date });
  const composer = new MailComposer({ from, to, cc, subject, text, messageId, date, attachments });
  return new Promise((resolve, reject) => composer.compile().build((error, message) => error ? reject(error) : resolve(message)));
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

export async function fetchMessage(account: AccountConfig, mailbox: string, uid: number) {
  return withImap(account, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const message = await client.fetchOne(uid, { source: true, envelope: true, flags: true }, { uid: true });
      if (message === false || !message.source) throw new Error(`Email not found: ${mailbox}/${uid}`);
      return message;
    } finally {
      lock.release();
    }
  });
}

export async function setMessageFlag(account: AccountConfig, mailbox: string, uid: number, flag: string, enabled: boolean) {
  return withImap(account, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      if (enabled) await client.messageFlagsAdd(uid, [flag], { uid: true });
      else await client.messageFlagsRemove(uid, [flag], { uid: true });
      return { mailbox, uid, flag, enabled };
    } finally {
      lock.release();
    }
  });
}

export const appleMailColorKeywords = {
  purple: ['$MailFlagBit0', '$MailFlagBit1', '$MailFlagBit2'],
  none: ['$MailFlagBit0', '$MailFlagBit1', '$MailFlagBit2']
};

export function appleMailColorOperations(color: keyof typeof appleMailColorKeywords) {
  if (color === 'purple') return { add: ['$MailFlagBit0', '$MailFlagBit2'], remove: ['$MailFlagBit1'] };
  return { add: [], remove: appleMailColorKeywords.none };
}

export async function setMessageColor(account: AccountConfig, mailbox: string, uid: number, color: keyof typeof appleMailColorKeywords) {
  return withImap(account, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const operations = appleMailColorOperations(color);
      if (operations.add.length) await client.messageFlagsAdd(uid, operations.add, { uid: true });
      if (operations.remove.length) await client.messageFlagsRemove(uid, operations.remove, { uid: true });
      return { mailbox, uid, color, ...operations };
    } finally {
      lock.release();
    }
  });
}

export async function moveMessage(account: AccountConfig, sourceMailbox: string, uid: number, targetMailbox: string) {
  return withImap(account, async (client) => {
    const sourceLock = await client.getMailboxLock(sourceMailbox);
    try {
      try {
        await client.messageMove(uid, targetMailbox, { uid: true });
      } catch {
        await client.messageCopy(uid, targetMailbox, { uid: true });
        await client.messageDelete(uid, { uid: true });
      }
      return { sourceMailbox, targetMailbox, uid };
    } finally {
      sourceLock.release();
    }
  });
}

export async function createMailbox(account: AccountConfig, mailbox: string) {
  return withImap(account, async (client) => {
    const boxes = await client.list();
    const existing = boxes.find((box) => box.path.toLowerCase() === mailbox.toLowerCase());
    if (existing) return { mailbox: existing.path, created: false };
    const parts = mailbox.split('/').filter(Boolean);
    let current = '';
    let created = false;
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!boxes.some((box) => box.path.toLowerCase() === current.toLowerCase())) {
        await client.mailboxCreate(current);
        created = true;
      }
    }
    return { mailbox, created };
  });
}

export async function appendToMailbox(account: AccountConfig, mailbox: string, message: Buffer, flags: string[] = []) {
  return withImap(account, async (client) => client.append(mailbox, message, flags));
}

export async function listMessageUids(account: AccountConfig, mailbox: string, since?: Date) {
  return withImap(account, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const query: Record<string, unknown> = since ? { since } : { all: true };
      const uids: number[] = [];
      for await (const message of client.fetch(query, { uid: true }, { uid: true })) uids.push(message.uid);
      return uids;
    } finally {
      lock.release();
    }
  });
}
