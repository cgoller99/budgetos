export type PlaidWebhookEvent = {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
  environment?: string;
  error?: {
    error_code?: string;
    error_message?: string;
  } | null;
};

export function parsePlaidWebhookEvent(body: string): PlaidWebhookEvent {
  return JSON.parse(body) as PlaidWebhookEvent;
}
