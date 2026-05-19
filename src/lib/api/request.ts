export async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readOptionalTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

export function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
