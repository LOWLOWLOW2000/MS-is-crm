/**
 * バッチ文字起こし（Whisper）が POST /ai/transcriptions/batch に送る1件分
 */
export interface TranscriptionItemDto {
  callRecordId: string;
  zoomMeetingId: string | null;
  recordingStorageUrl: string | null;
  durationSeconds: number | null;
  transcribedAt: string; // ISO8601
  transcriptionText: string;
}

export interface BatchTranscriptionsDto {
  tenantId: string;
  transcriptions: TranscriptionItemDto[];
}
