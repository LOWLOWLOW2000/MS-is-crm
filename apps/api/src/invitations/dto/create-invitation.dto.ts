import { ArrayMinSize, IsArray, IsEmail, IsIn } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

const ALL_ROLES = Object.values(UserRole) as string[];

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(ALL_ROLES, { each: true })
  roles!: UserRole[];
}
