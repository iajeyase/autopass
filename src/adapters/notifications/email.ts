// E-Mail-Adapter. Im MVP wird KEINE E-Mail versendet. Nachrichten werden nur protokolliert
// (Status LOGGED_ONLY). Produktion: transaktionaler Mailversand mit SPF/DKIM/DMARC-Konfiguration.

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export type EmailDelivery = 'LOGGED_ONLY' | 'SENT' | 'FAILED';

export async function sendEmail(message: EmailMessage): Promise<EmailDelivery> {
  if (process.env.NODE_ENV !== 'test') {
    console.info(`[E-Mail nur protokolliert, nicht versendet] an=${message.to} betreff="${message.subject}"`);
  }
  return 'LOGGED_ONLY';
}
