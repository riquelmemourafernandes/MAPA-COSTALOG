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

// MAPA contains operational and account data; prevent browsers and shared proxies from caching API responses.
app.use("/api/v1", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

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

app.get("/api/v1/dashboard/summary", async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [activeRecords, recentlyUpdated, statusRows] = await Promise.all([
      prisma.mapaRow.count({ where: { archivedAt: null } }),
      prisma.mapaRow.count({ where: { archivedAt: null, updatedAt: { gte: since } } }),
      prisma.mapaRow.groupBy({
        by: ["status"],
        where: { archivedAt: null },
        _count: { _all: true },
        orderBy: { _count: { status: "desc" } },
        take: 12
      })
    ]);
    return res.json({
      generatedAt: new Date().toISOString(),
      activeRecords,
      recentlyUpdated,
      statuses: statusRows.map(item => ({ status: item.status || "Sem status", count: item._count._all }))
    });
  } catch (error) { return next(error); }
});

app.get("/api/v1/mapa", async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, Number.parseInt(String(req.query.pageSize || "100"), 10) || 100));
    const search = String(req.query.search || "").trim().slice(0, 120);
    const status = String(req.query.status || "").trim().slice(0, 120);
    const filterColumn = String(req.query.filterColumn || "").trim().slice(0, 80);
    const filterValue = String(req.query.filterValue || "").trim().slice(0, 120);
    const searchLike = `%${search}%`;
    const filterLike = `%${filterValue}%`;
    const statusFilter = status && status !== "Todos os status" ? status : "";
    if (filterColumn && !(await prisma.mapaColumn.findUnique({ where: { key: filterColumn }, select: { key: true } }))) {
      return res.status(400).json({ error: { code: "INVALID_FILTER_COLUMN", message: "A coluna escolhida para o filtro não existe." } });
    }
    const [countRows, items] = await prisma.$transaction([
      prisma.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*)::bigint AS total FROM mapa_rows WHERE archived_at IS NULL AND (${statusFilter} = '' OR LOWER(COALESCE(status, '')) = LOWER(${statusFilter})) AND (${search} = '' OR data::text ILIKE ${searchLike} OR COALESCE(status, '') ILIKE ${searchLike} OR COALESCE(client_name, '') ILIKE ${searchLike} OR COALESCE(container, '') ILIKE ${searchLike} OR COALESCE(cte, '') ILIKE ${searchLike} OR COALESCE(operational_key, '') ILIKE ${searchLike}) AND (${filterColumn} = '' OR COALESCE(data ->> ${filterColumn}, '') ILIKE ${filterLike})`,
      prisma.$queryRaw<any[]> `SELECT id, sequence, operational_key AS "operationalKey", data, status, client_name AS "clientName", container, cte, collection_date AS "collectionDate", delivery_date AS "deliveryDate", archived_at AS "archivedAt", created_at AS "createdAt", updated_at AS "updatedAt", updated_by_id AS "updatedById" FROM mapa_rows WHERE archived_at IS NULL AND (${statusFilter} = '' OR LOWER(COALESCE(status, '')) = LOWER(${statusFilter})) AND (${search} = '' OR data::text ILIKE ${searchLike} OR COALESCE(status, '') ILIKE ${searchLike} OR COALESCE(client_name, '') ILIKE ${searchLike} OR COALESCE(container, '') ILIKE ${searchLike} OR COALESCE(cte, '') ILIKE ${searchLike} OR COALESCE(operational_key, '') ILIKE ${searchLike}) AND (${filterColumn} = '' OR COALESCE(data ->> ${filterColumn}, '') ILIKE ${filterLike}) ORDER BY sequence DESC OFFSET ${(page - 1) * pageSize} LIMIT ${pageSize}`
    ]);
    return res.json({ items, page, pageSize, total: Number(countRows[0]?.total || 0) });
  } catch (error) { return next(error); }
});

app.get("/api/v1/dashboard/appointment-alerts", async (_req, res, next) => {
  try {
    const now = new Date();
    const rows = await prisma.mapaRow.findMany({
      where: { archivedAt: null },
      select: { id: true, sequence: true, data: true, status: true, clientName: true, container: true, cte: true },
      orderBy: { sequence: "desc" }
    });
    const value = (data: Prisma.JsonValue, key: string): string => {
      if (!data || typeof data !== "object" || Array.isArray(data)) return "";
      const item = (data as Prisma.JsonObject)[key];
      return typeof item === "string" || typeof item === "number" ? String(item).trim() : "";
    };
    const parseAppointment = (input: string): number => {
      // Interpret Brazilian dates (DD/MM/YYYY or DD-MM-YYYY) before Date.parse,
      // which can otherwise read ambiguous values in US month/day order.
      const match = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
      if (match) {
        const [, dayText, monthText, yearText, hourText = "0", minuteText = "0", secondText = "0"] = match;
        const day = Number(dayText);
        const month = Number(monthText);
        const year = Number(yearText);
        const hour = Number(hourText);
        const minute = Number(minuteText);
        const second = Number(secondText);
        if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59 || hour < 0 || minute < 0 || second < 0) return Number.NaN;
        const date = new Date(year, month - 1, day, hour, minute, second);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return Number.NaN;
        return date.getTime();
      }
      const native = Date.parse(input);
      return Number.isFinite(native) ? native : Number.NaN;
    };
    const alerts: Array<{
      id: string; sequence: number; kind: "Coleta" | "Entrega";
      scheduledAt: string; minutesLate: number; attendant: string;
      clientName: string | null; container: string | null; cte: string | null; status: string | null;
    }> = [];
    for (const row of rows) {
      const data = row.data;
      const attendant = value(data, "B") || "Não informado";
      const collectionAppointment = value(data, "AL");
      const deliveryAppointment = value(data, "AP");
      // Coleta é considerada concluída quando AU (chegada ao terminal/EADI)
      // ou AV (saída do terminal/EADI) estiver preenchida.
      const collectionCompleted = Boolean(value(data, "AU") || value(data, "AV"));
      // Por decisão operacional, monitorar somente a primeira entrega (AP).
      // A segunda entrega (AS) fica fora dos alertas por enquanto.
      const deliveryCompleted = Boolean(value(data, "AW"));
      for (const candidate of [
        { kind: "Coleta" as const, scheduled: collectionAppointment, completed: collectionCompleted },
        { kind: "Entrega" as const, scheduled: deliveryAppointment, completed: deliveryCompleted }
      ]) {
        if (!candidate.scheduled || candidate.completed) continue;
        const timestamp = parseAppointment(candidate.scheduled);
        if (!Number.isFinite(timestamp) || timestamp >= now.getTime()) continue;
        alerts.push({
          id: row.id,
          sequence: row.sequence,
          kind: candidate.kind,
          scheduledAt: new Date(timestamp).toISOString(),
          minutesLate: Math.floor((now.getTime() - timestamp) / 60000),
          attendant,
          clientName: row.clientName,
          container: row.container,
          cte: row.cte,
          status: row.status
        });
      }
    }
    alerts.sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    return res.json({
      generatedAt: now.toISOString(),
      total: alerts.length,
      byKind: {
        collection: alerts.filter(item => item.kind === "Coleta").length,
        delivery: alerts.filter(item => item.kind === "Entrega").length
      },
      items: alerts.slice(0, 100)
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/v1/mapa/column-values", async (req, res, next) => {
  try {
    const key = String(req.query.key || "").trim().slice(0, 80);
    if (!key || !(await prisma.mapaColumn.findUnique({ where: { key }, select: { key: true } }))) {
      return res.status(400).json({ error: { code: "INVALID_COLUMN", message: "A coluna informada não existe." } });
    }
    const values = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT DISTINCT BTRIM(data ->> ${key}) AS value
      FROM mapa_rows
      WHERE archived_at IS NULL
        AND NULLIF(BTRIM(COALESCE(data ->> ${key}, '')), '') IS NOT NULL
      ORDER BY value ASC
      LIMIT 5000
    `;
    return res.json({ key, items: values.map(item => item.value) });
  } catch (error) { return next(error); }
});

app.get("/api/v1/mapa/validations", async (_req, res, next) => {
  try {
    const requiredColumns = await prisma.mapaColumn.findMany({
      where: { required: true },
      select: { key: true, label: true, dataType: true },
      orderBy: { position: "asc" }
    });
    const activeCount = await prisma.mapaRow.count({ where: { archivedAt: null } });
    const checks = await Promise.all(requiredColumns.map(async (column) => {
      const result = await prisma.$queryRaw<Array<{ total: bigint; missing: bigint }>>`
        SELECT COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(data ->> ${column.key}, '')), '') IS NULL)::bigint AS missing
        FROM mapa_rows WHERE archived_at IS NULL
      `;
      return {
        key: column.key,
        label: column.label || column.key,
        dataType: column.dataType,
        total: Number(result[0]?.total || 0),
        missing: Number(result[0]?.missing || 0)
      };
    }));
    return res.json({
      checkedAt: new Date().toISOString(),
      totalRows: activeCount,
      requiredFields: checks.length,
      items: checks.filter(item => item.missing > 0).sort((a, b) => b.missing - a.missing)
    });
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

app.delete("/api/v1/mapa/:id", requireRole(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERACAO), async (req, res, next) => {
  try {
    const existing = await prisma.mapaRow.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.archivedAt) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Registro não encontrado." } });
    }
    await prisma.$transaction(async (tx) => {
      await tx.mapaRow.update({
        where: { id: existing.id },
        data: { archivedAt: new Date(), updatedById: req.authUser!.id }
      });
      await tx.auditLog.create({
        data: {
          entityType: "MAPA_ROW",
          entityId: existing.id,
          mapaRowId: existing.id,
          action: "DELETE",
          beforeValue: (existing.data && typeof existing.data === "object" ? existing.data : {}) as Prisma.InputJsonValue,
          afterValue: Prisma.JsonNull,
          userId: req.authUser!.id
        }
      });
    });
    return res.json({ success: true, id: existing.id });
  } catch (error) {
    return next(error);
  }
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



const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().max(254).optional(),
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: z.string().min(10).max(200).optional()
}).refine(data => Boolean(data.name || data.email || data.newPassword), "Informe ao menos um campo para alterar.");

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string().min(10).max(200),
  role: z.nativeEnum(UserRole).default(UserRole.CONSULTA),
  active: z.boolean().default(true)
});

app.get("/api/v1/auth/profile", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id }, select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true } });
    if (!user) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Usuário não encontrado." } });
    return res.json({ user });
  } catch (error) { return next(error); }
});

app.patch("/api/v1/auth/profile", async (req, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Revise os dados do perfil." } });
    const current = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!current) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Usuário não encontrado." } });
    const data: Prisma.UserUpdateInput = {};
    if (parsed.data.name) data.name = parsed.data.name;
    if (parsed.data.email) data.email = parsed.data.email.trim().toLocaleLowerCase("pt-BR");
    if (parsed.data.newPassword) {
      if (!parsed.data.currentPassword || !(await bcrypt.compare(parsed.data.currentPassword, current.passwordHash))) {
        return res.status(400).json({ error: { code: "CURRENT_PASSWORD_INVALID", message: "A senha atual está incorreta." } });
      }
      data.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    }
    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: current.id },
        data,
        select: { id: true, name: true, email: true, role: true, active: true, updatedAt: true }
      });
      await tx.auditLog.create({
        data: {
          entityType: "USER",
          entityId: updatedUser.id,
          action: "PROFILE_UPDATE",
          userId: current.id,
          afterValue: { name: updatedUser.name, email: updatedUser.email }
        }
      });
      return updatedUser;
    });
    return res.json({ user });
  } catch (error) { return next(error); }
});

app.get("/api/v1/users", requireRole(UserRole.ADMIN), async (_req, res, next) => {
  try {
    const items = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true }, orderBy: { name: "asc" } });
    return res.json({ items });
  } catch (error) { return next(error); }
});

app.post("/api/v1/users", requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Informe nome, e-mail, senha com pelo menos 10 caracteres e perfil válido." } });
    const email = parsed.data.email.trim().toLocaleLowerCase("pt-BR");
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: { code: "EMAIL_IN_USE", message: "Já existe um usuário com este e-mail." } });
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: parsed.data.name,
          email,
          passwordHash: await bcrypt.hash(parsed.data.password, 12),
          role: parsed.data.role,
          active: parsed.data.active
        },
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }
      });
      await tx.auditLog.create({
        data: {
          entityType: "USER",
          entityId: createdUser.id,
          action: "USER_CREATE",
          userId: req.authUser!.id,
          afterValue: { name: createdUser.name, email: createdUser.email, role: createdUser.role, active: createdUser.active }
        }
      });
      return createdUser;
    });
    return res.status(201).json({ user });
  } catch (error) { return next(error); }
});

app.patch("/api/v1/users/:id", requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const schema = z.object({ name: z.string().trim().min(2).max(120).optional(), email: z.string().email().max(254).optional(), role: z.nativeEnum(UserRole).optional(), active: z.boolean().optional(), newPassword: z.string().min(10).max(200).optional() }).refine(data => Object.keys(data).length > 0);
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Dados de usuário inválidos." } });
    if (req.params.id === req.authUser!.id && parsed.data.active === false) return res.status(400).json({ error: { code: "SELF_DEACTIVATION", message: "Não é possível bloquear sua própria conta." } });
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Usuário não encontrado." } });

    // Prevent accidental lockout by ensuring at least one active administrator remains.
    const removesAdminAccess = before.active && before.role === UserRole.ADMIN &&
      (parsed.data.active === false || (parsed.data.role !== undefined && parsed.data.role !== UserRole.ADMIN));
    if (removesAdminAccess) {
      const activeAdmins = await prisma.user.count({ where: { active: true, role: UserRole.ADMIN } });
      if (activeAdmins <= 1) {
        return res.status(400).json({
          error: { code: "LAST_ACTIVE_ADMIN", message: "Não é possível desativar ou rebaixar o último administrador ativo." }
        });
      }
    }
    if (req.params.id === req.authUser!.id && parsed.data.role !== undefined && parsed.data.role !== UserRole.ADMIN) {
      return res.status(400).json({
        error: { code: "SELF_DEMOTION", message: "Não é possível rebaixar o próprio perfil administrativo." }
      });
    }

    const data: Prisma.UserUpdateInput = {};
    if (parsed.data.name) data.name = parsed.data.name;
    if (parsed.data.email) data.email = parsed.data.email.trim().toLocaleLowerCase("pt-BR");
    if (parsed.data.role) data.role = parsed.data.role;
    if (typeof parsed.data.active === "boolean") data.active = parsed.data.active;
    if (parsed.data.newPassword) data.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: before.id },
        data,
        select: { id: true, name: true, email: true, role: true, active: true, updatedAt: true }
      });
      await tx.auditLog.create({
        data: {
          entityType: "USER",
          entityId: updatedUser.id,
          action: "USER_ADMIN_UPDATE",
          userId: req.authUser!.id,
          beforeValue: { name: before.name, email: before.email, role: before.role, active: before.active },
          afterValue: { name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, active: updatedUser.active }
        }
      });
      return updatedUser;
    });
    return res.json({ user });
  } catch (error) { return next(error); }
});

app.get("/api/v1/preferences", async (req, res, next) => {
  try {
    const record = await prisma.lookupValue.findUnique({ where: { listName_normalized: { listName: "USER_PREFERENCES", normalized: req.authUser!.id } } });
    return res.json({ preferences: record?.metadata || {} });
  } catch (error) { return next(error); }
});

app.put("/api/v1/preferences", async (req, res, next) => {
  try {
    const schema = z.object({ visibleKeys: z.array(z.string().max(80)).max(128).optional(), columnOrder: z.array(z.string().max(80)).max(128).optional(), savedViews: z.array(z.object({ name: z.string().trim().min(1).max(80), visibleKeys: z.array(z.string().max(80)).max(128), query: z.string().max(120).default(""), status: z.string().max(120).default("") })).max(50).optional(), cellStyles: z.record(z.string().max(200), z.object({ bold: z.boolean().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })).optional() }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Preferências inválidas." } });
    const metadata = parsed.data as Prisma.InputJsonObject;
    const record = await prisma.lookupValue.upsert({
      where: { listName_normalized: { listName: "USER_PREFERENCES", normalized: req.authUser!.id } },
      create: { listName: "USER_PREFERENCES", normalized: req.authUser!.id, label: "Preferências do usuário", metadata },
      update: { metadata, label: "Preferências do usuário" }
    });
    return res.json({ preferences: record.metadata });
  } catch (error) { return next(error); }
});

app.get("/api/v1/mapa/:id/history", async (req, res, next) => {
  try {
    const field = String(req.query.field || "").slice(0, 80);
    const row = await prisma.mapaRow.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!row) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Registro não encontrado." } });
    const items = await prisma.auditLog.findMany({
      where: { mapaRowId: row.id, ...(field ? { OR: [{ fieldKey: field }, { fieldKey: { contains: field } }, { action: "CREATE" }] } : {}) },
      include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100
    });
    // Audit snapshots may contain unrelated operational data. Return only the
    // requested cell's values, never the full before/after row to the browser.
    const cellValue = (snapshot: Prisma.JsonValue | null, key: string): Prisma.JsonValue | null => {
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
      const object = snapshot as Prisma.JsonObject;
      return Object.prototype.hasOwnProperty.call(object, key) ? { [key]: object[key] } : null;
    };
    const safeItems = items.map(item => ({
      ...item,
      beforeValue: field ? cellValue(item.beforeValue, field) : null,
      afterValue: field ? cellValue(item.afterValue, field) : null
    }));
    return res.json({ items: safeItems });
  } catch (error) { return next(error); }
});

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  // Log diagnostic details privately; never expose internal errors to the client.
  const diagnostic = error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError", message: String(error) };
  console.error("[API_ERROR]", { method: req.method, path: req.path, ...diagnostic });
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
