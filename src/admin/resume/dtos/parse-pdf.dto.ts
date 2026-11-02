import { IsUUID } from 'class-validator';

export class ParsePdfDto {

  @IsUUID()
  clientId: string;
  // The client whose uploaded PDF will be fetched from
  // Supabase Storage and sent to Gemini for parsing.
}