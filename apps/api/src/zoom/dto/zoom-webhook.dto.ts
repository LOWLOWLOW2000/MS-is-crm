interface ZoomWebhookObject {
  id?: string | number;
  uuid?: string;
  topic?: string;
  host_email?: string;
  start_time?: string;
  end_time?: string;
  account_id?: string;
  custom_keys?: {
    tenantId?: string;
  };
}

interface ZoomWebhookPayload {
  account_id?: string;
  object?: ZoomWebhookObject;
  plainToken?: string;
}

export interface ZoomWebhookDto {
  event?: string;
  event_ts?: number;
  payload?: ZoomWebhookPayload;
}

export interface ZoomUrlValidationResponseDto {
  plainToken: string;
  encryptedToken: string;
}
