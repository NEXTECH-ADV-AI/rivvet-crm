/** Accept copied or autofilled codes without spaces or punctuation. */
export function normalizeSignInCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}
