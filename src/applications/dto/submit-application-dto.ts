import { IsUUID, IsOptional, IsNumber } from 'class-validator';

export class SubmitApplicationDto {
  @IsUUID()
  clientId: string;

  @IsUUID()
  resumeId: string;

  @IsUUID()
  jobId: string;

  @IsNumber()
  @IsOptional()
  atsScore?: number;
}