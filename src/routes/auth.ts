// src/routes/auth.ts
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ENV } from "../env";
import { signJwt, verifyJwt } from "../middlewares/authJwt";

const router = Router();

/* -------------------------------------------------------
   Model (temporário em memória — depois trocamos por Mongo)
-------------------------------------------------------- */
type User = {
  name: string;
  email: string;          // normalizado (lowercase, trim)
  passwordHash: string;   // bcrypt hash
  createdAt: Date;
};
const users = new Map<string, User>(); // key = email

/* -------------------------------------------------------
   Schemas
-------------------------------------------------------- */
const signupSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

/* -------------------------------------------------------
   Helpers
-------------------------------------------------------- */
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function signToken(user: Pick<User, "email" | "name">) {
  return signJwt(
    { sub: user.email, name: user.name },
    ENV.TOKEN_EXPIRES_IN || "7d"
  );
}

async function upsertUser(name: string, email: string, password: string) {
  const emailNorm = normalizeEmail(email);
  const existing = users.get(emailNorm);
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 10);
  const user: User = {
    name: name.trim(),
    email: emailNorm,
    passwordHash,
    createdAt: new Date(),
  };
  users.set(emailNorm, user);
  return user;
}

/** Seed automático do primeiro e-mail de ADMIN_EMAILS */
async function seedAdminFromEnv() {
  try {
    const auto = (process.env.AUTO_SEED_ADMIN ?? "true").toLowerCase() !== "false";
    if (!auto) return;

    const admins = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (admins.length === 0) return;

    const email = admins[0];
    const password = process.env.ADMIN_SEED_PASSWORD || "123456";
    await upsertUser("Admin", email, password);
  } catch {
    // silencioso
  }
}

/* -------------------------------------------------------
   Handlers
-------------------------------------------------------- */
async function signupHandler(req: Request, res: Response) {
  const parse = signupSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "validation_error", issues: parse.error.flatten() });
  }

  const { name, email, password } = parse.data;
  const emailNorm = normalizeEmail(email);

  if (users.has(emailNorm)) {
    return res.status(409).json({ error: "email_in_use" });
  }

  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 10);
  const user: User = {
    name: name.trim(),
    email: emailNorm,
    passwordHash,
    createdAt: new Date(),
  };

  users.set(emailNorm, user);

  const token = signToken(user);
  return res.status(201).json({ token, user: { name: user.name, email: user.email } });
}

async function loginHandler(req: Request, res: Response) {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "validation_error", issues: parse.error.flatten() });
  }

  const { email, password } = parse.data;
  const emailNorm = normalizeEmail(email);

  const user = users.get(emailNorm);
  if (!user) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const token = signToken(user);
  return res.json({ token, user: { name: user.name, email: user.email } });
}

function meHandler(req: Request, res: Response) {
  try {
    const auth = req.headers.authorization || "";
    const pref = "Bearer ";
    if (!auth.startsWith(pref)) {
      return res.status(401).json({ error: "missing_token" });
    }
    const token = auth.slice(pref.length);

    const payload = verifyJwt(token);
    const email = String(payload.sub || "").toLowerCase();
    if (!email) return res.status(401).json({ error: "invalid_token" });

    const user = users.get(email);
    if (!user) return res.status(404).json({ error: "user_not_found" });

    return res.json({ user: { name: user.name, email: user.email } });
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

/* -------------------------------------------------------
   Dev/Seed & Reset Admin (protegidos por chave)
-------------------------------------------------------- */
async function seedAdminHandler(req: Request, res: Response) {
  const key = req.header("x-seed-key");
  if (!key || key !== (process.env.SEED_KEY || ENV.JWT_SECRET)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const adminEmail =
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)[0] || "admin@myglobyx.com";

  const pwd = process.env.ADMIN_SEED_PASSWORD || "123456";
  const user = await upsertUser("Admin", adminEmail, pwd);

  return res.json({ ok: true, user: { email: user.email, name: user.name } });
}

/** Reinicializa/atualiza a senha do admin (re-hash com BCRYPT_ROUNDS atual) */
async function resetAdminHandler(req: Request, res: Response) {
  const key = req.header("x-seed-key");
  if (!key || key !== (process.env.SEED_KEY || ENV.JWT_SECRET)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const body = (req.body ?? {}) as { email?: string; password?: string; name?: string };
  const email =
    (body.email ||
      (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)[0] ||
      "admin@myglobyx.com").trim().toLowerCase();

  const password = String(body.password || process.env.ADMIN_SEED_PASSWORD || "123456");
  const name = String(body.name || "Admin");

  // re-hash com custo atual
  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 10);

  const existing = users.get(email);
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = name;
    return res.json({ ok: true, action: "updated", user: { email, name } });
  }

  const user: User = { name, email, passwordHash, createdAt: new Date() };
  users.set(email, user);
  return res.json({ ok: true, action: "created", user: { email, name } });
}

/* -------------------------------------------------------
   Rotas “oficiais”
   (mantemos compatibilidade com /api/users/* também)
-------------------------------------------------------- */
router.post("/auth/signup", signupHandler);
router.post("/auth/login", loginHandler);
router.get("/auth/me", meHandler);

// Dev tools (protegidos por x-seed-key)
router.post("/auth/dev/seed-admin", seedAdminHandler);
router.post("/auth/dev/reset-admin", resetAdminHandler);

// Aliases de compatibilidade
router.post("/api/users/signup", signupHandler);
router.post("/api/users/login", loginHandler);

export default router;

/* -------------------------------------------------------
   Bootstrap: cria admin em memória no start (se configurado)
-------------------------------------------------------- */
void seedAdminFromEnv();
