import { IsObject } from 'class-validator';

export class ApproveClientDto {

  @IsObject()
  resumeJson: Record<string, any>;
  // The final Atomic JSON after admin review and corrections.
  // If no changes were made, this is the same JSON that was fetched.
  // This replaces the existing BaseResume.resumeJson on approval.
}