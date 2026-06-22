const MAX_OPAQUE_ENTITY_ID_LENGTH = 180;
const CONTROL_OR_PATH_SEPARATOR_PATTERN = /[\u0000-\u001f\u007f/\\]/;

export function normalizeOpaqueEntityId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_OPAQUE_ENTITY_ID_LENGTH) {
    return null;
  }
  if (CONTROL_OR_PATH_SEPARATOR_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function assertOpaqueEntityId(value: string, errorMessage: string): string {
  const normalized = normalizeOpaqueEntityId(value);
  if (!normalized) {
    throw new Error(errorMessage);
  }
  return normalized;
}
