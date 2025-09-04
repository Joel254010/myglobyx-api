import bcrypt from "bcryptjs";
import { usersCol, UserDoc } from "./mongo";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || process.env.BCRYPT_SALT_ROUNDS || 10);

function norm(email: string) {
  return email.trim().toLowerCase();
}

/** Busca usuário pelo e-mail (normalizado) */
export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const col = await usersCol();
  return col.findOne({ email: norm(email) });
}

/** Cria usuário (erro se e-mail já existir) */
export async function createUser(
  name: string,
  email: string,
  password: string
): Promise<UserDoc> {
  const col = await usersCol();
  const emailNorm = norm(email);

  const already = await col.findOne({ email: emailNorm });
  if (already) {
    const err: any = new Error("email_in_use");
    err.code = "email_in_use";
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, ROUNDS);
  const now = new Date();
  const doc = {
    name: name.trim(),
    email: emailNorm,
    passwordHash,
    createdAt: now,
  } as Omit<UserDoc, "_id"> as any;

  const res = await col.insertOne(doc);
  return { _id: res.insertedId, ...doc } as UserDoc;
}

/** Upsert para seeds/reset de admin (atualiza nome/senha; cria se não existir) */
export async function upsertUserPassword(
  name: string,
  email: string,
  password: string
): Promise<UserDoc> {
  const col = await usersCol();
  const emailNorm = norm(email);
  const passwordHash = await bcrypt.hash(password, ROUNDS);

  await col.updateOne(
    { email: emailNorm },
    { $set: { name: name.trim(), passwordHash }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  const user = await col.findOne({ email: emailNorm });
  if (!user) throw new Error("upsert_failed");
  return user;
}

/** Atualiza somente o hash de senha (caso já tenha sido calculado fora) */
export async function setPasswordHash(email: string, passwordHash: string): Promise<void> {
  const col = await usersCol();
  await col.updateOne({ email: norm(email) }, { $set: { passwordHash } });
}

/** Helper opcional para comparar senha */
export async function verifyPassword(user: UserDoc, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}
