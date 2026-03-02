import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SendWhatsAppToContactTool {
  private readonly logger = new Logger(SendWhatsAppToContactTool.name);

  declaration: FunctionDeclaration = {
    name: 'send_whatsapp_to_contact',
    description:
      'Envía un mensaje de WhatsApp a un contacto usando su número de teléfono. ' +
      'Usá esta herramienta cuando el operador confirme que quiere avisar a la contraparte de un evento. ' +
      'El mensaje debe ser breve y profesional.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        phone: {
          type: SchemaType.STRING,
          description:
            'Número de teléfono del destinatario. Puede ser solo el número local (ej: "2804309736") ' +
            'o con prefijo internacional (ej: "5492804309736"). No incluir + ni espacios.',
        },
        message: {
          type: SchemaType.STRING,
          description:
            'Texto del mensaje a enviar. Debe ser profesional y mencionar el evento agendado.',
        },
      },
      required: ['phone', 'message'],
    },
  };

  async execute(args: { phone: string; message: string }): Promise<{
    sent: boolean;
    to: string;
    message?: string;
    error?: string;
  }> {
    const botUrl = process.env.BOT_SELF_URL ?? 'http://localhost:3011';
    const apiKey = process.env.API_KEY ?? '';

    // Normalize phone: strip non-digits, ensure starts with 549 for Argentina
    const digits = args.phone.replace(/\D/g, '');
    const to = digits.startsWith('549')
      ? digits
      : digits.startsWith('54')
        ? digits
        : `549${digits}`;

    this.logger.log(`[SendWhatsAppToContact] Sending to ${to}`);

    try {
      const res = await fetch(`${botUrl}/whatsapp/message/send/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({ to, text: args.message }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`[SendWhatsAppToContact] Bot responded ${res.status}: ${body}`);
        return { sent: false, to, error: `Error ${res.status}: ${body}` };
      }

      this.logger.log(`[SendWhatsAppToContact] Message sent successfully to ${to}`);
      return { sent: true, to, message: args.message };
    } catch (err) {
      this.logger.error(`[SendWhatsAppToContact] Fetch error: ${err.message}`);
      return { sent: false, to, error: err.message };
    }
  }
}
