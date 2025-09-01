// src/utils/crypto.ts
import bcrypt from "bcryptjs";
import { ENV } from "../env";

const DEFAULT_ROUNDS = 10;
const MIN_ROUNDS = 8;
const MAX_ROUNDS = 12;

function getRounds(): number {
  const raw = Number(ENV.BCRYPT_ROUNDS ?? DEFAULT_ROUNDS);
  if (Number.isFinite(raw)) {
    return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.floor(raw)));
  }
  return DEFAULT_ROUNDS;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(getRounds());
  return bcrypt.hash(String(plain), salt);
}

export function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(String(plain), String(hash));
}
