import { IsString, IsNotEmpty, IsUUID, IsObject } from 'class-validator';

export class CreateBaseResumeDto {

  @IsUUID()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  resumeName: string;
  // Human-readable name for this base resume.
  // e.g. "Tech Focus v1", "Management Focus v1"

  @IsObject()
  resumeJson: Record<string, any>;
  // The full Atomic JSON structure after admin has reviewed
  // and edited it in the Visual Resume Editor.
  // Validated by ResumeValidatorService before saving.
}