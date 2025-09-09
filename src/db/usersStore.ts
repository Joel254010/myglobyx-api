import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { ObjectId } from "mongodb";
import { usersCol } from "./mongo"; // ✅ Removido o `UserDoc`
import { ENV } from "../env";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  passwordHash: string; // ✅ Aqui
  name?: string;
  isVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  verificationToken?: string;
  verificationExpires?: Date;
  phone?: string;
  birthdate?: string;
  document?: string;
  address?: any;
}

export type UserDocWithId = UserDoc & {
  _id: ObjectId;
  passwordHash?: string;
  name?: string;
  phone?: string;
  isVerified?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

const ROUNDS = Number(ENV.BCRYPT_ROUNDS || 10);
const TOKEN_TTL_MINUTES = Number(process.env.EMAIL_TOKEN_TTL_MINUTES || 60);
const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || "http://localhost:5000").trim();
const EMAIL_FROM = (process.env.EMAIL_FROM || "MyGlobyX <no-reply@myglobyx.com>").trim();

function norm(email: string) {
  return String(email || "").trim().toLowerCase();
}

function makeVerifyLink(token: string) {
  return `${API_PUBLIC_URL}${ENV.API_PREFIX || "/api"}/auth/verify?token=${encodeURIComponent(token)}`;
}

function getMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env as Record<string, string | undefined>;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendWelcomeVerificationEmail(to: string, verifyLink: string, name?: string) {
  const transporter = getMailer();
  const subject = "Confirme seu acesso • MyGlobyX";
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2>Bem-vindo${name ? ", " + name.split(" ")[0] : ""}! 🎉</h2>
      <p>Para ativar sua conta e fazer o primeiro acesso, clique no botão abaixo:</p>
      <p style="margin:24px 0">
        <a href="${verifyLink}" style="background:#1366FF;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">
          Confirmar meu e-mail
        </a>
      </p>
      <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p style="word-break:break-all"><a href="${verifyLink}">${verifyLink}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <small>Se você não criou uma conta, ignore este e-mail.</small>
    </div>
  `;
  if (!transporter) {
    console.log("📧 [DEV] E-mail (dry-run) para:", to);
    console.log("Assunto:", subject);
    console.log("🔗 Link de verificação:", verifyLink);
    return;
  }
  try {
    await transporter.sendMail({ from: EMAIL_FROM, to, subject, html });
  } catch (err) {
    console.error("⚠️ Falha ao enviar e-mail:", (err as Error)?.message);
  }
}

export async function initializeUserIndexes(): Promise<void> {
  const col = await usersCol();
  try { await col.createIndex({ email: 1 }, { unique: true, name: "uniq_email" }); } catch {}
  try { await col.createIndex({ createdAt: -1 }, { name: "by_createdAt_desc" }); } catch {}
  try { await col.createIndex({ isVerified: 1 }, { name: "by_isVerified" }); } catch {}
  try { await col.createIndex({ verificationToken: 1, verificationExpires: 1 }, { name: "by_verify_token" }); } catch {}
}

export async function findUserByEmail(email: string): Promise<UserDocWithId | null> {
  const col = await usersCol();
  return (await col.findOne({ email: norm(email) } as any)) as UserDocWithId | null;
}

export async function createUser(name: string, email: string, password: string, phone?: string): Promise<UserDocWithId> {
  const col = await usersCol();
  const emailNorm = norm(email);
  const already = await col.findOne({ email: emailNorm } as any);
  if (already) {
    const err: any = new Error("email_in_use");
    err.code = "email_in_use";
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  const now = new Date();
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  const doc: Omit<UserDocWithId, "_id"> & {
    updatedAt?: Date;
    phone?: string;
    verificationToken?: string;
    verificationExpires?: Date;
    birthdate?: string;
    document?: string;
    address?: any;
  } = {
    name: name.trim(),
    email: emailNorm,
    passwordHash,
    createdAt: now,
    updatedAt: now,
    isVerified: false,
    verificationToken,
    verificationExpires,
    ...(phone ? { phone: String(phone).trim() } : {}),
  };

  const res = await col.insertOne(doc as any);
  const created: UserDocWithId = { _id: res.insertedId as any, ...doc } as UserDocWithId;

  const link = makeVerifyLink(verificationToken);
  await sendWelcomeVerificationEmail(created.email, link, created.name);

  return created;
}

export async function upsertUserPassword(name: string, email: string, password: string): Promise<UserDocWithId> {
  const col = await usersCol();
  const emailNorm = norm(email);
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  const now = new Date();
  await col.updateOne(
    { email: emailNorm } as any,
    {
      $set: {
        name: name.trim(),
        passwordHash,
        updatedAt: now,
      } as any,
      $setOnInsert: { createdAt: now } as any,
    },
    { upsert: true }
  );
  const user = (await col.findOne({ email: emailNorm } as any)) as UserDocWithId | null;
  if (!user) throw new Error("upsert_failed");
  return user;
}

export async function setPasswordHash(email: string, password: string): Promise<void> {
  const col = await usersCol();
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  await col.updateOne(
    { email: norm(email) } as any,
    { $set: { passwordHash, updatedAt: new Date() } as any }
  );
}

export async function verifyPassword(user: Pick<UserDocWithId, "passwordHash">, password: string): Promise<boolean> {
  return bcrypt.compare(password, (user as any).passwordHash);
}

export async function setUserPhone(email: string, phone: string): Promise<void> {
  const col = await usersCol();
  await col.updateOne(
    { email: norm(email) } as any,
    { $set: { phone: String(phone).trim(), updatedAt: new Date() } as any }
  );
}

export async function reissueVerification(email: string): Promise<{ sent: boolean; linkDev: string }> {
  const col = await usersCol();
  const emailNorm = norm(email);
  const user = (await col.findOne({ email: emailNorm } as any)) as any;
  if (!user) throw new Error("user_not_found");
  if (user.isVerified) return { sent: false, linkDev: "" };

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await col.updateOne(
    { _id: user._id } as any,
    { $set: { verificationToken, verificationExpires, updatedAt: new Date() } as any }
  );

  const link = makeVerifyLink(verificationToken);
  await sendWelcomeVerificationEmail(user.email, link, user.name);

  return { sent: true, linkDev: link };
}

export type AddressPatch = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
};

export type ProfilePatch = {
  name?: string;
  phone?: string;
  birthdate?: string;
  document?: string;
  address?: AddressPatch;
};

export async function updateUserProfile(email: string, patch: ProfilePatch): Promise<UserDocWithId | null> {
  const col = await usersCol();
  const emailNorm = norm(email);
  const user = (await col.findOne({ email: emailNorm } as any)) as any;
  if (!user) return null;

  const now = new Date();
  const $set: any = { updatedAt: now };
  if (patch.name !== undefined) $set.name = String(patch.name).trim();
  if (patch.phone !== undefined) $set.phone = String(patch.phone).trim();
  if (patch.birthdate !== undefined) $set.birthdate = String(patch.birthdate).trim();
  if (patch.document !== undefined) $set.document = String(patch.document).trim();
  if (patch.address !== undefined) {
    const prevAddr = (user as any).address || {};
    const nextAddr: any = { ...prevAddr, ...patch.address };
    if (nextAddr.state) nextAddr.state = String(nextAddr.state).trim().toUpperCase();
    $set.address = nextAddr;
  }
  await col.updateOne({ _id: user._id } as any, { $set });
  const updated = (await col.findOne(
    { _id: user._id } as any,
    { projection: { passwordHash: 0 } as any }
  )) as UserDocWithId | null;
  return updated;
}

export async function listUsersBasic(page = 1, limit = 25): Promise<{
  total: number;
  users: Array<{
    name: string;
    email: string;
    phone?: string;
    isVerified?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  }>;
}> {
  const col = await usersCol();
  const skip = Math.max(0, (page - 1) * limit);
  const [total, docs] = await Promise.all([
    col.countDocuments({}),
    col
      .find(
        {},
        { projection: { name: 1, email: 1, phone: 1, isVerified: 1, createdAt: 1, updatedAt: 1 } }
      )
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);
  const users = docs.map((d: any) => ({
    name: d.name,
    email: d.email,
    phone: d.phone,
    isVerified: d.isVerified,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
  return { total, users };
}

export async function verifyByToken(token: string): Promise<boolean> {
  const col = await usersCol();
  const user = await col.findOne({ verificationToken: token }) as UserDoc;

  if (!user) return false;
  if (user.verificationExpires && user.verificationExpires < new Date()) return false;

  await col.updateOne(
    { _id: user._id },
    {
      $set: { isVerified: true, updatedAt: new Date() },
      $unset: { verificationToken: "", verificationExpires: "" },
    }
  );

  return true;
}

