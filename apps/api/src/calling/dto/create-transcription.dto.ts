/**
 * Phase2: バッチ（Whisper文字起こし後）が文字起こし結果を保存する用
 */
export class CreateTranscriptionDto {
  callRecordId!: string;
  zoomMeetingId?: string;
  recordingStorageUrl?: string;
  durationSeconds?: number;
  transcriptionText!: string;
  transcribedAt?: string; // ISO。未指定時はサーバー現在時刻
}
