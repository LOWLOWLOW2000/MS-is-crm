import { IsOptional, IsString } from 'class-validator'

export class CreateCallingSessionDto {
  @IsOptional()
  @IsString()
  startedAt?: string
}

