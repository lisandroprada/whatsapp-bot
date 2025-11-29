import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'messages' })
export class Message extends Document {
  @Prop({ required: true })
  jid: string;

  @Prop({ required: true })
  fromMe: boolean;

  @Prop()
  type: string;

  @Prop()
  content: string;

  @Prop()
  fileName?: string;

  @Prop()
  fileSize?: number;

  @Prop()
  mimeType?: string;

  @Prop({ required: true })
  timestamp: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
