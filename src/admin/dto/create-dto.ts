import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {

@IsNotEmpty()
@IsString()
firstName: string;

@IsNotEmpty()
@IsString()
lastName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;
  // Raw password — passed to Supabase Auth only.
  // Never stored in our database. Supabase hashes it internally.
}