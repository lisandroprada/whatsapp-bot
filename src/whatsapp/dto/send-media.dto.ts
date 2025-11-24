export class SendMediaDto {
  to: string;
  caption: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'document';
}
