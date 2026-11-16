export function parseOrigins(...values: string[]): string[] {
  return [...new Set(values.flatMap((value) => value.split(",").map((part) => part.trim()).filter(Boolean)))];
}
