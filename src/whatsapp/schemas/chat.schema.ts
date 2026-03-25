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

  @Prop({ default: null })
  avatarUrl: string | null;

  @Prop({ default: null })
  avatarUpdatedAt: Date | null;

  @Prop({ default: false })
  isOperator: boolean;

  @Prop({ default: null })
  operatorAgentId: string | null;

  @Prop({ default: null })
  operatorUserId: string | null;

  @Prop({ default: null })
  operatorCompanyId: string | null;

  // ===== Showing pre-qualification state =====
  @Prop({ default: null })
  activeShowingCaseId: string | null;

  @Prop({ type: [String], default: [] })
  showingDocsReceived: string[]; // e.g. ['titular', 'garante']
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
