export interface SmsMessage {
  /** E.164, e.g. +2348031234567 */
  to: string;
  body: string;
}

export interface SmsSendResult {
  providerId?: string;
}

export interface SmsSender {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

export const SMS_SENDER = Symbol('SMS_SENDER');
