import 'dotenv/config';

export type AccountConfig = {
  name: string;
  address: string;
  imap: { host: string; port: number; secure: boolean; user: string; password: string };
  smtp: { host: string; port: number; secure: boolean; user: string; password: string };
};

function account(n: number): AccountConfig | null {
  const p = `EMAIL_ACCOUNT_${n}_`;
  const name = process.env[`${p}NAME`];
  if (!name) return null;
  const required = (key: string) => {
    const value = process.env[`${p}${key}`];
    if (!value) throw new Error(`Missing ${p}${key}`);
    return value;
  };
  return {
    name,
    address: required('ADDRESS'),
    imap: { host: required('IMAP_HOST'), port: Number(process.env[`${p}IMAP_PORT`] ?? 993), secure: (process.env[`${p}IMAP_SECURE`] ?? 'true') === 'true', user: required('IMAP_USER'), password: required('IMAP_PASSWORD') },
    smtp: { host: required('SMTP_HOST'), port: Number(process.env[`${p}SMTP_PORT`] ?? 465), secure: (process.env[`${p}SMTP_SECURE`] ?? 'true') === 'true', user: required('SMTP_USER'), password: required('SMTP_PASSWORD') }
  };
}

export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 8787),
  bearerToken: process.env.MCP_BEARER_TOKEN ?? '',
  allowSend: (process.env.ALLOW_SEND ?? 'false') === 'true',
  allowDrafts: (process.env.ALLOW_DRAFTS ?? 'false') === 'true',
  accounts: Array.from({ length: 20 }, (_, i) => account(i + 1)).filter((a): a is AccountConfig => a !== null)
};

if (config.accounts.length === 0) throw new Error('Configure at least one EMAIL_ACCOUNT_N_* account');
if (process.env.NODE_ENV === 'production' && config.bearerToken.length < 32) throw new Error('MCP_BEARER_TOKEN must be at least 32 characters in production');
