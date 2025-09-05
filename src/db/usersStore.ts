// src/db/usersStore.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { usersCol, UserDoc } from "./mongo";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || process.env.BCRYPT_SALT_ROUNDS || 10);
const TOKEN_TTL_MINUTES = Number(process.env.EMAIL_TOKEN_TTL_MINUTES || 60);
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || "http://localhost:4000";
const EMAIL_FROM = process.env.EMAIL_FROM || "MyGlobyX <no-reply@myglobyx.com>";

function norm(email: string) {
  return email.trim().toLowerCase();
}

/** Monta link GET de verificação que sua rota /api/auth/verify deve tratar */
function makeVerifyLink(token: string) {
  return `${API_PUBLIC_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
}

/** Transport condicional: se SMTP_* não estiver setado, vira dry-run (só console.log) */
function getMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env as Record<string, string | undefined>;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null; // dry-run
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/** Envia e-mail real se SMTP configurado; senão apenas loga (dry-run) */
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
    // Dry-run
    // eslint-disable-next-line no-console
    console.log("📧 [DEV] E-mail (dry-run) para:", to);
    // eslint-disable-next-line no-console
    console.log("Assunto:", subject);
    // eslint-disable-next-line no-console
    console.log("🔗 Link de verificação:", verifyLink);
    return;
  }

  await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });
}

/** ✅ (Opcional) Cria índices importantes. Chame 1x no boot do app. */
export async function initializeUserIndexes(): Promise<void> {
  const col = await usersCol();
  try {
    await col.createIndex({ email: 1 }, { unique: true, name: "uniq_email" });
  } catch {}
  try {
    await col.createIndex({ createdAt: -1 }, { name: "by_createdAt_desc" });
  } catch {}
  try {
    await col.createIndex({ isVerified: 1 }, { name: "by_isVerified" });
  } catch {}
  try {
    await col.createIndex({ verificationToken: 1, verificationExpires: 1 }, { name: "by_verify_token" });
  } catch {}
}

/** Busca usuário pelo e-mail (normalizado) */
export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const col = await usersCol();
  return col.findOne({ email: norm(email) });
}

/**
 * Cria usuário real:
 *  - salva hash
 *  - cria token de verificação (expira em TOKEN_TTL_MINUTES)
 *  - envia e-mail de boas-vindas com link
 */
export async function createUser(
  name: string,
  email: string,
  password: string,
  phone?: string
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

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  const doc = {
    name: name.trim(),
    email: emailNorm,
    passwordHash,
    createdAt: now,
    updatedAt: now,
    isVerified: false,
    verificationToken,
    verificationExpires,
    ...(phone ? { phone: String(phone).trim() } : {}),
  } as Omit<UserDoc, "_id"> as any;

  const res = await col.insertOne(doc);
  const created: UserDoc = { _id: res.insertedId, ...doc } as UserDoc;

  // Enviar e-mail (ou dry-run logando o link)
  const link = makeVerifyLink(verificationToken);
  await sendWelcomeVerificationEmail(created.email, link, created.name);

  return created;
}

/** Upsert para seeds/reset de admin (mantém verificado se desejar) */
export async function upsertUserPassword(
  name: string,
  email: string,
  password: string
): Promise<UserDoc> {
  const col = await usersCol();
  const emailNorm = norm(email);
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  const now = new Date();

  await col.updateOne(
    { email: emailNorm },
    {
      $set: {
        name: name.trim(),
        passwordHash,
        updatedAt: now,
        // isVerified: true, // descomente se quiser admins sempre verificados
      } as any,
      $setOnInsert: { createdAt: now } as any,
    },
    { upsert: true }
  );

  const user = await col.findOne({ email: emailNorm });
  if (!user) throw new Error("upsert_failed");
  return user;
}

/** Atualiza somente o hash de senha */
export async function setPasswordHash(email: string, passwordHash: string): Promise<void> {
  const col = await usersCol();
  await col.updateOne(
    { email: norm(email) },
    { $set: { passwordHash, updatedAt: new Date() } as any }
  );
}

/** Compara senha */
export async function verifyPassword(user: UserDoc, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

/** ✅ Define/atualiza telefone do usuário */
export async function setUserPhone(email: string, phone: string): Promise<void> {
  const col = await usersCol();
  await col.updateOne(
    { email: norm(email) },
    { $set: { phone: String(phone).trim(), updatedAt: new Date() } as any }
  );
}

/** Reemite token e reenvia e-mail de verificação (ex.: usuário pediu de novo) */
export async function reissueVerification(email: string): Promise<{ sent: boolean; linkDev: string }> {
  const col = await usersCol();
  const emailNorm = norm(email);
  const user = await col.findOne({ email: emailNorm });
  if (!user) throw new Error("user_not_found");
  if ((user as any).isVerified) return { sent: false, linkDev: "" };

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await col.updateOne(
    { _id: user._id },
    { $set: { verificationToken, verificationExpires, updatedAt: new Date() } as any }
  );

  const link = makeVerifyLink(verificationToken);
  await sendWelcomeVerificationEmail(user.email, link, (user as any).name);

  return { sent: true, linkDev: link };
}

/**
 * Confirma o usuário pelo token (usado pela rota GET /api/auth/verify)
 * Retorna true se confirmou, false se token inválido/expirado.
 */
export async function verifyByToken(token: string): Promise<boolean> {
  const col = await usersCol();
  const now = new Date();

  const user = await col.findOne({
    verificationToken: token,
    verificationExpires: { $gt: now },
  });

  if (!user) return false;

  await col.updateOne(
    { _id: user._id },
    {
      $set: { isVerified: true, updatedAt: now } as any,
      $unset: { verificationToken: "", verificationExpires: "" } as any,
    }
  );

  return true;
}

/**
 * Listagem básica para o Painel Admin (paginada)
 * Mostra dados mínimos: nome, e-mail, telefone, verificado, datas.
 */
export async function listUsersBasic(
  page = 1,
  limit = 25
): Promise<{
  total: number;
  users: Array<{
    name: string;
    email: string;
    phone?: string;
    isVerified?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
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

  const users = docs.map((d) => ({
    name: d.name,
    email: d.email,
    phone: (d as any).phone,
    isVerified: (d as any).isVerified,
    createdAt: d.createdAt,
    updatedAt: (d as any).updatedAt,
  }));

  return { total, users };
}
