import { IsString, MaxLength } from 'class-validator'

export class UpsertListItemDirectorNoteDto {
  @IsString()
  @MaxLength(8000)
  bodyMarkdown!: string
}
