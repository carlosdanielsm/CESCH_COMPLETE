export function normalizeText(rawText: string) {
  if (!rawText) return "";

  return rawText
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\t+/g, " ")
    .replace(/ +/g, " ")
    .trim();
}
