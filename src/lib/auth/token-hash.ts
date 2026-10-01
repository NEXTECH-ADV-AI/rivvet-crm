/**
 * The sign-in email travels quoted-printable and the template's `=` before the
 * token is not escaped, so some mail clients (Gmail, seen 2026-10-01) hand us
 * `token_hash=3D<hash>`: the literal "3D" glued to the front. Supabase then says
 * "Email link is invalid or has expired" on every tap. Token hashes are 56 hex
 * chars, so a 58-char value starting with 3D can only be this mangling (RIV-1534).
 * The client portal repairs the same emails in its confirm-link.ts.
 */
export function normalizeTokenHash(raw: string): string {
  const t = raw.trim();
  return /^3D[0-9a-f]{56}$/i.test(t) ? t.slice(2) : t;
}
