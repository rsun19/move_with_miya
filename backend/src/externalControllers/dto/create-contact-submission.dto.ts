import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
export class CreateContactSubmissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => trimString(value as unknown))
  name: string;

  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => trimString(value as unknown))
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Transform(({ value }) => trimString(value as unknown))
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  @Transform(({ value }) => trimString(value as unknown))
  message: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  turnstileToken: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  contactChallenge: string;
}
