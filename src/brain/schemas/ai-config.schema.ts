import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiConfigDocument = AiConfig & Document;

@Schema({ timestamps: true })
export class AiConfig {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  value: string;

  @Prop()
  updatedBy: string;
}

export const AiConfigSchema = SchemaFactory.createForClass(AiConfig);
