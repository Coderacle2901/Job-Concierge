import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStaffDto {

  @IsString()
  @IsNotEmpty()
    firstName: string;

  @IsString()
  @IsNotEmpty()
    lastName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;
  // Passed to Supabase Auth only — never stored in our DB.

  @IsOptional()
  @IsString()
  department?: string;
  // e.g. "Resume Team", "Applications Team"
  // Optional — can be assigned later.
}
