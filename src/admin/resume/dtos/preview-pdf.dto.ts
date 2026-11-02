import { IsObject } from 'class-validator';

export class PreviewPdfDto {

  @IsObject()
  resumeJson: Record<string, any>;
  // Raw Atomic JSON sent directly from the editor.
  // PDF is generated and returned without saving to DB.
  // Used so admin can preview the resume before committing to save.
} 