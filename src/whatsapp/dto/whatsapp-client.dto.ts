import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateClientWhatsAppDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  whatsappJid?: string;

  @IsOptional()
  @IsBoolean()
  autoDetected?: boolean;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}

export class VerifyWhatsAppDto {
  @IsString()
  phone: string;
}

export class WhatsAppContactDto {
  @IsString()
  jid: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsBoolean()
  verified: boolean;
}

export class SyncWhatsAppContactsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppContactDto)
  contacts: WhatsAppContactDto[];
}
