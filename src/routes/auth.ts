// src/routes/auth.ts
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import { ENV } from "../env";

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
  const secret = ENV.JWT_SECRET || "change-me";
  return jwt.sign(
    { sub: user.email, name: user.name },
    secret,
    { algorithm: "HS256", expiresIn: "7d" }
  );
}

/* -------------------------------------------------------
   Handlers
-------------------------------------------------------- */
async function signupHandler(req: Request, res: Response) {
  const parse = signupSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      error: "validation_error",
      issues: parse.error.flatten(),
    });
  }

  const { name, email, password } = parse.data;
  const emailNorm = normalizeEmail(email);

  if (users.has(emailNorm)) {
    return res.status(409).json({ error: "email_in_use" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    name: name.trim(),
    email: emailNorm,
    passwordHash,
    createdAt: new Date(),
  };

  users.set(emailNorm, user);

  const token = signToken(user);
  return res.status(201).json({
    token,
    user: { name: user.name, email: user.email },
  });
}

async function loginHandler(req: Request, res: Response) {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      error: "validation_error",
      issues: parse.error.flatten(),
    });
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
  return res.json({
    token,
    user: { name: user.name, email: user.email },
  });
}

function meHandler(req: Request, res: Response) {
  try {
    const auth = req.headers.authorization || "";
    const pref = "Bearer ";
    if (!auth.startsWith(pref)) {
      return res.status(401).json({ error: "missing_token" });
    }
    const token = auth.slice(pref.length);
    const payload = jwt.verify(token, ENV.JWT_SECRET || "change-me") as JwtPayload;

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
   Rotas “oficiais”
   (mantemos compatibilidade com /api/users/* também)
-------------------------------------------------------- */
router.post("/auth/signup", signupHandler);
router.post("/auth/login", loginHandler);
router.get("/auth/me", meHandler);

// Aliases de compatibilidade
router.post("/api/users/signup", signupHandler);
router.post("/api/users/login", loginHandler);

export default router;
