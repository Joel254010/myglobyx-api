// src/db/usersStore.ts

export type User = {
  id: string;
  name: string;
  email: string;        // sempre normalizado (lowercase/trim)
  passwordHash: string; // bcrypt hash
  createdAt: string;    // ISO string
};

// Índices em memória (será trocado por Mongo depois)
const byId = new Map<string, User>();
const byEmail = new Map<string, string>(); // email normalizado -> id

export function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

export function getUserById(id: string): User | null {
  return byId.get(id) ?? null;
}

export function findUserByEmail(email: string): User | null {
  const id = byEmail.get(normalizeEmail(email));
  return id ? byId.get(id) ?? null : null;
}

/**
 * Cria usuário garantindo e-mail único (case-insensitive).
 * Lança Error("email_in_use") se já existir.
 */
export function createUser(u: User): User {
  const emailNorm = normalizeEmail(u.email);
  if (byEmail.has(emailNorm)) {
    throw new Error("email_in_use");
  }
  const toSave: User = {
    ...u,
    email: emailNorm,
    createdAt: u.createdAt ?? new Date().toISOString(),
  };
  byId.set(toSave.id, toSave);
  byEmail.set(emailNorm, toSave.id);
  return toSave;
}

/** Opcional: retorna versão pública sem hash */
export function toPublicUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt };
}

/** Utilitário para testes/dev */
export function _clearUsersStore() {
  byId.clear();
  byEmail.clear();
}
