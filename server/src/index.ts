import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET || "";
const allowedOrigin = process.env.FRONTEND_ORIGIN || "";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigin && process.env.NODE_ENV !== "production") return callback(null, true);
    if (allowedOrigin && origin === allowedOrigin) return callback(null, true);
    return callback(new Error("Origem não autorizada."));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200)
});

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!jwtSecret || jwtSecret.length < 32) {
    return res.status(503).json({
      error: { code: "AUTH_NOT_CONFIGURED", message: "A autenticação ainda não foi configurada pelo administrador." }
    });
  }
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Faça login para continuar." } });

  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, jwtSecret, { issuer: "mapa-costalog-api", audience: "mapa-costalog" });
  } catch {
    return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Sessão inválida ou expirada." } });
  }
  if (typeof decoded === "string" || !decoded.sub) {
    return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Sessão inválida." } });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: String(decoded.sub) } });
    if (!user || !user.active) {
      return res.status(401).json({ error: { code: "INACTIVE_USER", message: "Usuário inativo ou não encontrado." } });
    }
    req.authUser = { id: user.id, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}
function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Seu perfil não permite esta ação." } });
    }
    return next();
  };
}

const createRowSchema = z.object({
  data: z.record(z.string().min(1).max(80), z.union([z.string().max(20000), z.number().finite(), z.boolean(), z.null()])).default({})
});

const patchSchema = z.object({
  changes: z.record(
    z.string().min(1).max(80),
    z.union([z.string().max(20000), z.number().finite(), z.boolean(), z.null()])
  ).refine(
    (changes) => Object.keys(changes).length > 0 && Object.keys(changes).length <= 40,
    "Informe entre 1 e 40 campos por alteração."
  ),
  expectedUpdatedAt: z.string().datetime().optional()
});

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", service: "mapa-costalog-api", databaseConfigured: Boolean(process.env.DATABASE_URL) });
});

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });

app.post("/api/v1/auth/login", loginLimiter, async (req, res, next) => {
  try {
    if (!jwtSecret || jwtSecret.length < 32) {
      return res.status(503).json({ error: { code: "AUTH_NOT_CONFIGURED", message: "A autenticação ainda não foi configurada pelo administrador." } });
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Informe e-mail e senha válidos." } });
    }
    const email = parsed.data.email.trim().toLocaleLowerCase("pt-BR");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos." } });
    }
    const token = jwt.sign({ role: user.role }, jwtSecret, { subject: user.id, expiresIn: "8h", issuer: "mapa-costalog-api", audience: "mapa-costalog" });
    return res.json({ token, expiresIn: 28800, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    return next(error);
  }
});

app.use("/api/v1", requireAuth);

app.get("/api/v1/auth/me", (req, res) => {
  res.json({ user: req.authUser });
});

app.get("/api/v1/config/columns", async (_req, res, next) => {
  try {
    const columns = await prisma.mapaColumn.findMany({
      orderBy: { position: "asc" }
    });
    res.json({ items: columns });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/mapa", async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, Number.parseInt(String(req.query.pageSize || "100"), 10) || 100));
    const search = String(req.query.search || "").trim().slice(0, 120);
    const status = String(req.query.status || "").trim().slice(0, 120);
    const searchLike = `%${search}%`;
    const statusFilter = status && status !== "Todos os status" ? status : "";
    const [countRows, items] = await prisma.$transaction([
      prisma.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*)::bigint AS total FROM mapa_rows WHERE archived_at IS NULL AND (${statusFilter} = '' OR LOWER(COALESCE(status, '')) = LOWER(${statusFilter})) AND (${search} = '' OR data::text ILIKE ${searchLike} OR COALESCE(status, '') ILIKE ${searchLike} OR COALESCE(client_name, '') ILIKE ${searchLike} OR COALESCE(container, '') ILIKE ${searchLike} OR COALESCE(cte, '') ILIKE ${searchLike} OR COALESCE(operational_key, '') ILIKE ${searchLike})`,
      prisma.$queryRaw<any[]> `SELECT id, sequence, operational_key AS "operationalKey", data, status, client_name AS "clientName", container, cte, collection_date AS "collectionDate", delivery_date AS "deliveryDate", archived_at AS "archivedAt", created_at AS "createdAt", updated_at AS "updatedAt", updated_by_id AS "updatedById" FROM mapa_rows WHERE archived_at IS NULL AND (${statusFilter} = '' OR LOWER(COALESCE(status, '')) = LOWER(${statusFilter})) AND (${search} = '' OR data::text ILIKE ${searchLike} OR COALESCE(status, '') ILIKE ${searchLike} OR COALESCE(client_name, '') ILIKE ${searchLike} OR COALESCE(container, '') ILIKE ${searchLike} OR COALESCE(cte, '') ILIKE ${searchLike} OR COALESCE(operational_key, '') ILIKE ${searchLike}) ORDER BY sequence DESC OFFSET ${(page - 1) * pageSize} LIMIT ${pageSize}`
    ]);
    return res.json({ items, page, pageSize, total: Number(countRows[0]?.total || 0) });
  } catch (error) { return next(error); }
});

app.post("/api/v1/mapa", requireRole(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERACAO), async (req, res, next) => {
  try {
    const parsed = createRowSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Dados do novo registro inválidos.", details: parsed.error.issues } });
    const keys = Object.keys(parsed.data.data);
    if (keys.length > 128) return res.status(400).json({ error: { code: "TOO_MANY_FIELDS", message: "O registro excede as 128 colunas do MAPA." } });
    const cols = await prisma.mapaColumn.findMany({ where: { key: { in: keys }, editable: true } });
    const allowed = new Map(cols.map(col => [col.key, col]));
    const rejected = keys.filter(key => !allowed.has(key));
    if (rejected.length) return res.status(400).json({ error: { code: "FIELDS_NOT_EDITABLE", message: "Existem colunas inválidas ou não editáveis.", details: rejected } });
    for (const [key, value] of Object.entries(parsed.data.data)) {
      const type = allowed.get(key)!.dataType;
      const valid = value === null || ((type === "number" || type === "currency") ? typeof value === "number" : type === "boolean" ? typeof value === "boolean" : typeof value === "string");
      if (!valid) return res.status(400).json({ error: { code: "INVALID_FIELD_TYPE", message: `Valor inválido para a coluna ${key}.` } });
    }
    const data = parsed.data.data as Prisma.InputJsonObject;
    const valueFor = (key: string) => typeof data[key] === "string" ? data[key] as string : null;
    const row = await prisma.$transaction(async tx => {
      const created = await tx.mapaRow.create({ data: {
        data,
        status: valueFor("C"), clientName: valueFor("L"), container: valueFor("T"), cte: valueFor("D"), updatedById: req.authUser!.id
      } });
      await tx.auditLog.create({ data: { entityType: "MAPA_ROW", entityId: created.id, mapaRowId: created.id, action: "CREATE", userId: req.authUser!.id, afterValue: data } });
      return created;
    });
    return res.status(201).json({ item: row });
  } catch (error) { return next(error); }
});

app.patch("/api/v1/mapa/:id", requireRole(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERACAO), async (req, res, next) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Revise os campos informados.", details: parsed.error.issues }
      });
    }
    const existing = await prisma.mapaRow.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.archivedAt) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Registro não encontrado." } });
    }
    if (parsed.data.expectedUpdatedAt &&
        existing.updatedAt.toISOString() !== parsed.data.expectedUpdatedAt) {
      return res.status(409).json({
        error: { code: "EDIT_CONFLICT", message: "Este registro foi alterado por outra pessoa. Atualize a tela antes de salvar." }
      });
    }

    const allowedColumns = await prisma.mapaColumn.findMany({
      where: { key: { in: Object.keys(parsed.data.changes) }, editable: true }
    });
    const allowedKeys = new Set(allowedColumns.map((column) => column.key));
    const rejected = Object.keys(parsed.data.changes).filter((key) => !allowedKeys.has(key));
    if (rejected.length) {
      return res.status(400).json({
        error: { code: "FIELDS_NOT_EDITABLE", message: "Um ou mais campos não existem ou não podem ser editados.", details: rejected }
      });
    }
    const invalidTypes = allowedColumns.filter((column) => {
      const value = parsed.data.changes[column.key];
      if (value === null) return false;
      if (column.dataType === "number" || column.dataType === "currency") return typeof value !== "number";
      if (column.dataType === "boolean") return typeof value !== "boolean";
      if (column.dataType === "date" || column.dataType === "datetime") {
        return typeof value !== "string" || Number.isNaN(Date.parse(value));
      }
      return typeof value !== "string";
    }).map((column) => column.key);
    if (invalidTypes.length) {
      return res.status(400).json({
        error: { code: "INVALID_FIELD_TYPE", message: "Um ou mais valores não correspondem ao tipo da coluna.", details: invalidTypes }
      });
    }

    const before = (existing.data && typeof existing.data === "object" && !Array.isArray(existing.data)
      ? existing.data : {}) as Record<string, Prisma.JsonValue>;
    const after = { ...before, ...parsed.data.changes } as Prisma.InputJsonObject;
    const indexFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.data.changes)) {
      if (typeof value !== "string") continue;
      const label = allowedColumns.find((column) => column.key === key)?.label.toLocaleUpperCase("pt-BR");
      if (label === "STATUS" && key === "C") indexFields.status = value;
      if (label === "CLIENTE") indexFields.clientName = value;
      if (label === "CONTAINER") indexFields.container = value;
      if (label === "CTE") indexFields.cte = value;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.mapaRow.update({
        where: { id: existing.id },
        data: { data: after, updatedById: req.authUser!.id, ...indexFields }
      });
      await tx.auditLog.create({
        data: {
          entityType: "MAPA_ROW",
          entityId: existing.id,
          mapaRowId: existing.id,
          action: "UPDATE",
          fieldKey: Object.keys(parsed.data.changes).join(","),
          beforeValue: before as Prisma.InputJsonValue,
          afterValue: after,
          userId: req.authUser!.id
        }
      });
      return row;
    });
    return res.json({ item: updated });
  } catch (error) {
    return next(error);
  }
});


app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Keep internal error details out of HTTP responses.
  if (process.env.NODE_ENV !== "production") console.error(error);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Não foi possível concluir a solicitação." }
  });
});

const server = app.listen(port, () => {
  console.log(`MAPA Costalog API ouvindo na porta ${port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
