import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContactSubmissionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  subject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
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
