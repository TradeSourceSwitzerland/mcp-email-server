declare module 'mailparser' {
  export function simpleParser(source: Buffer | string): Promise<any>;
}

declare module 'nodemailer' {
  const nodemailer: { createTransport(options: any): any };
  export default nodemailer;
}
