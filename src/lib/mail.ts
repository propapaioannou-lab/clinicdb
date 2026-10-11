import nodemailer, { type Transporter } from "nodemailer";

// Rule (SPEC §2, §10): emails carry links and names only — never clinical data.

let transport: Transporter | undefined;

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP_HOST is not set (see .env.example)");
  transport ??= nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

export async function sendMail(to: string, subject: string, text: string, html: string) {
  await getTransport().sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
}

export function appUrl(path: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
