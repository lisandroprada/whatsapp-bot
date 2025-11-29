import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'chats' })
export class Chat extends Document {
  @Prop({ unique: true, required: true })
  jid: string;

  @Prop()
  name: string;

  @Prop({ default: 0 })
  unreadCount: number;

  @Prop({ type: Object })
  lastMessage: object;

  @Prop({ default: true })
  isBotActive: boolean; // Permite activar/desactivar bot en este chat

  @Prop({ default: null })
  coreClientId: string; // ID del cliente en Core Backend (null = no registrado)

  @Prop({ default: 'BOT', enum: ['BOT', 'HUMAN'] })
  mode: string; // Modo actual: BOT = bot responde, HUMAN = solo humano
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
