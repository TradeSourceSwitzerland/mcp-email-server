declare module 'mailparser' {
  export function simpleParser(source: Buffer | string): Promise<any>;
}

declare module 'nodemailer' {
  const nodemailer: { createTransport(options: any): any };
  export default nodemailer;
}

declare module 'nodemailer/lib/mail-composer/index.js' {
  export default class MailComposer {
    constructor(options: any);
    compile(): { build(callback: (error: Error | null, message: Buffer) => void): void };
  }
}
