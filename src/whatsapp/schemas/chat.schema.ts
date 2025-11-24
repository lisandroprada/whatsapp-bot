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
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
