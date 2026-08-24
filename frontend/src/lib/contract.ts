export type ApiContractEnvelope<T = unknown> = {
  success?: boolean;
  data?: T | null;
  error?: string | null;
  message?: string | null;
  [key: string]: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function isContractEnvelope(value: unknown): value is ApiContractEnvelope {
  const record = asRecord(value);
  if (!record) return false;

  return "data" in record && ("success" in record || "error" in record || "message" in record);
}

export function extractContractData<T>(value: unknown): T {
  if (isContractEnvelope(value)) {
    return (value.data as T) ?? (null as T);
  }

  return value as T;
}

export function isContractFailure(value: unknown): boolean {
  if (!isContractEnvelope(value)) return false;

  if (value.success === false) return true;
  if (typeof value.error === "string" && value.error.trim().length > 0) return true;
  return false;
}

export function extractContractMessage(value: unknown, fallback: string): string {
  const record = asRecord(value);
  if (!record) return fallback;

  const error = typeof record.error === "string" ? record.error.trim() : "";
  if (error) return error;

  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (message) return message;

  return fallback;
}
