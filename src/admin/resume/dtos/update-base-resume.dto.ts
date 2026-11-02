import { IsObject } from 'class-validator';

export class UpdateBaseResumeDto {

  @IsObject()
  resumeJson: Record<string, any>;
  // Updated Atomic JSON after admin edits a field in the editor.
  // Full JSON is sent — not just the changed node.
  // ResumeValidatorService validates the entire structure before saving.
}