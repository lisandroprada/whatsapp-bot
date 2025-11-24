import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'whatsapp_sessions' })
export class WhatsappSession extends Document {
  @Prop({ unique: true, required: true })
  instanceName: string;

  @Prop({ type: Object })
  creds: object;

  @Prop()
  status: string;
}

export const WhatsappSessionSchema = SchemaFactory.createForClass(WhatsappSession);
