import { IsString } from 'class-validator'

export class PublishCallingPackSnapshotDto {
  @IsString()
  snapshotId!: string
}

