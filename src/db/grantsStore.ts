// src/db/grantsStore.ts
export type Grant = {
  id: string;
  email: string;     // normalizado
  productId: string;
  createdAt: string;
  expiresAt?: string;
};

const grants = new Map<string, Grant>();

function grantId(email: string, productId: string) {
  return `${email.toLowerCase()}::${productId}`;
}

export function grantsForEmail(email: string): Grant[] {
  const key = email.toLowerCase();
  return Array.from(grants.values()).filter(g => g.email === key);
}

export function grantAccess(email: string, productId: string, expiresAt?: string): Grant {
  const id = grantId(email, productId);
  const g: Grant = { id, email: email.toLowerCase(), productId, createdAt: new Date().toISOString(), expiresAt };
  grants.set(id, g);
  return g;
}

export function revokeAccess(email: string, productId: string): boolean {
  return grants.delete(grantId(email, productId));
}

export function allGrants(): Grant[] {
  return Array.from(grants.values());
}
