/**
 * Detecta se o phone armazenado é um placeholder interno (não é
 * telefone real) e retorna null nesse caso. Senão devolve só os
 * dígitos (sem o prefixo 55).
 *
 * Prefixos de placeholder usados pelo sistema:
 * - "placeholder-..."   (apoiador sem telefone real)
 * - "cleared-..."       (limpos via /api/admin/clear-shared-phones)
 * - "import-..."        (coord/líder importados sem phone)
 * - "temp-..."          (legacy)
 */
export function displayPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw);
  if (
    s.startsWith("placeholder") ||
    s.startsWith("cleared-") ||
    s.startsWith("import-") ||
    s.startsWith("temp-")
  ) return null;
  const d = s.replace(/\D/g, "");
  if (!d) return null;
  return d.startsWith("55") ? d.slice(2) : d;
}

/** Versão que retorna string vazia em vez de null (pra usar em inputs). */
export function displayPhoneOrEmpty(raw: string | null | undefined): string {
  return displayPhone(raw) ?? "";
}
