import { IsObject } from 'class-validator'

export class UpsertReportingFormatBodyDto {
  @IsObject()
  schemaJson!: Record<string, unknown>
}
