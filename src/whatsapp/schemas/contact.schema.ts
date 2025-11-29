import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Schema de Contacto para gestionar usuarios de WhatsApp
 * Vincula JID de WhatsApp con datos del cliente en Core Backend
 */
@Schema({ timestamps: true, collection: 'contacts' })
export class Contact extends Document {
  @Prop({ unique: true, required: true })
  jid: string; // WhatsApp JID (ej: 5491122334455@s.whatsapp.net)

  @Prop()
  coreClientId: string; // ID del cliente en el Core Backend

  @Prop()
  name: string; // Nombre del cliente

  @Prop()
  dni: string; // DNI/CUIT del cliente

  @Prop({ default: false })
  isVerified: boolean; // true si completó validación OTP

  @Prop({ type: Object })
  metadata: object; // Datos adicionales del Core Backend (email, phone, etc.)
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
