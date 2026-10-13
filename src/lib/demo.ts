// The online DEMO (Render + Neon, fake data only): one switch, DEMO_MODE=1, set only in the
// demo's hosting settings. It turns off everything that could reach a real person or a
// real system: e-mail, document uploads, and every future outside connection (GHL,
// WhatsApp…, which must check isDemo() before sending anything). Login there is password
// only (no 2FA), and every page shows the «ΔΟΚΙΜΑΣΤΙΚΗ ΕΚΔΟΣΗ» banner + «💬 Πρόταση».
export function isDemo(): boolean {
  return process.env.DEMO_MODE === "1";
}
