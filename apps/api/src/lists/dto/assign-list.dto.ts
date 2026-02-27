import { IsEmail } from 'class-validator';

export class AssignListDto {
  @IsEmail()
  assigneeEmail!: string;
}
