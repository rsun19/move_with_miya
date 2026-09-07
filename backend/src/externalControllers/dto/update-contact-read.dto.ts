import { IsBoolean } from 'class-validator';

export class UpdateContactReadDto {
  @IsBoolean()
  read: boolean;
}
