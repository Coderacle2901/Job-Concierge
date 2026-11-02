import { IsString, IsNotEmpty } from 'class-validator';

export class DuplicateResumeDto {

  @IsString()
  @IsNotEmpty()
  newResumeName: string;
  // Name for the duplicated resume.
  // e.g. "Tech Focus v2", "Remote Focus v1"
}