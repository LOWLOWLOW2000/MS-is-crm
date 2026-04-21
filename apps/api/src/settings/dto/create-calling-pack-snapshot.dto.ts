import { IsObject } from 'class-validator'

export class CreateCallingPackSnapshotDto {
  /** pack の全体JSON（正規化せず丸ごと保持） */
  @IsObject()
  bodyJson!: Record<string, unknown>
}

