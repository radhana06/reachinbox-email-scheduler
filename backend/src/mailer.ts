import nodemailer, { Transporter } from 'nodemailer';

export interface SenderRow {
  id: number;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
}

const cache = new Map<number, Transporter>();

function transporterFor(s: SenderRow) {
  let t = cache.get(s.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: s.smtp_host,
      port: s.smtp_port,
      secure: false,
      auth: { user: s.smtp_user, pass: s.smtp_pass },
    });
    cache.set(s.id, t);
  }
  return t;
}

export async function sendMail(s: SenderRow, to: string, subject: string, body: string) {
  const info = await transporterFor(s).sendMail({ from: s.email, to, subject, text: body });
  return { messageId: info.messageId, previewUrl: (nodemailer.getTestMessageUrl(info) as string) || null };
}

/** Creates a fresh fake inbox on ethereal.email */
export async function createEtherealSender() {
  const acc = await nodemailer.createTestAccount();
  return { email: acc.user, smtp_host: acc.smtp.host, smtp_port: acc.smtp.port, smtp_user: acc.user, smtp_pass: acc.pass };
}
