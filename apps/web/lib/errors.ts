type ServiceError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export function serviceError(context: string, value: unknown): Error {
  if (value instanceof Error) return value;
  if (value && typeof value === "object") {
    const error = value as ServiceError;
    const parts = [error.message, error.details, error.hint].filter(Boolean);
    const code = error.code ? ` [${error.code}]` : "";
    return new Error(`${context}${code}: ${parts.join(" · ") || "未知服務錯誤"}`);
  }
  return new Error(`${context}: ${String(value)}`);
}
