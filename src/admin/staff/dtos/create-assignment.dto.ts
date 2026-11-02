import {
  IsUUID,
  IsInt,
  IsPositive,
  IsDateString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
export class CreateAssignmentDto {

  @IsUUID()
  staffId: string;

  @IsUUID()
  clientId: string;


  @IsUUID()
  baseResumeId: string;
  // Required — each assignment must be associated with a specific base resume.


  @IsInt()
  @Min(1)
  targetApplications: number;
  // Monthly application target for this assignment.
  // e.g. 25 means staff must submit 25 applications for this client.

  @IsDateString()
  startDate: string;
  // ISO date string e.g. "2026-05-01"

  @IsDateString()
  endDate: string;
  // ISO date string e.g. "2026-05-31"

  @IsOptional()
  @IsString()
  notes?: string;
}