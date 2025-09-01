// src/id.ts
import { randomUUID, randomBytes } from "crypto";

/**
 * Gera um ID curto, sem hífens, em MAIÚSCULAS.
 * Usa crypto.randomUUID() quando disponível; fallback para randomBytes.
 * Tamanho ~24 chars (bom equilíbrio entre legibilidade e unicidade).
 */
export function genId(): string {
  try {
    // uuid v4 -> remove hífens -> pega 24 chars -> MAIÚSCULAS
    return randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase();
  } catch {
    // fallback (ambientes antigos)
    return randomBytes(16).toString("hex").slice(0, 24).toUpperCase();
  }
}
