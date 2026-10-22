import { timingSafeEqual } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 3001);
const apiToken = process.env.MAPA_API_TOKEN || "";
const allowedOrigin = process.env.FRONTEND_ORIGIN || "";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigin || origin === allowedOrigin) return callback(null, true);
    return callback(new Error("Origem não autorizada."));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));

function tokenMatches(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function requireApiToken(req: Request, res: Response, next: NextFunction) {
  if (!apiToken) {
    return res.status(503).json({
      error: { code: "API_NOT_CONFIGURED", message: "A API ainda não foi configurada pelo administrador." }
    });
  }
  const header = req.header("authorization") || "";
  const received = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!tokenMatches(received, apiToken)) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Autenticação necessária." }
    });
  }
  return next();
}

const patchSchema = z.object({
  changes: z.record(z.string().min(1).max(80), z.unknown()).refine(
    (changes) => Object.keys(changes).length > 0 && Object.keys(changes).length <= 40,
    "Informe entre 1 e 40 campos por alteração."
  ),
  expectedUpdatedAt: z.string().datetime().optional()
});

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", service: "mapa-costalog-api", databaseConfigured: Boolean(process.env.DATABASE_URL) });
});

app.use("/api/v1", requireApiToken);

app.get("/api/v1/config/columns", async (_req, res, next) => {
  try {
    const columns = await prisma.mapaColumn.findMany({
      where: { visible: true },
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
    const where: Prisma.MapaRowWhereInput = { archivedAt: null };
    if (status && status !== "Todos os status") where.status = { equals: status, mode: "insensitive" };
    if (search) {
      where.OR = [
        { status: { contains: search, mode: "insensitive" } },
        { clientName: { contains: search, mode: "insensitive" } },
        { container: { contains: search, mode: "insensitive" } },
        { cte: { contains: search, mode: "insensitive" } },
        { operationalKey: { contains: search, mode: "insensitive" } }
      ];
    }
    const [total, items] = await prisma.$transaction([
      prisma.mapaRow.count({ where }),
      prisma.mapaRow.findMany({
        where,
        orderBy: { sequence: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    res.json({ items, page, pageSize, total });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/v1/mapa/:id", async (req, res, next) => {
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
        data: { data: after, ...indexFields }
      });
      await tx.auditLog.create({
        data: {
          entityType: "MAPA_ROW",
          entityId: existing.id,
          mapaRowId: existing.id,
          action: "UPDATE",
          fieldKey: Object.keys(parsed.data.changes).join(","),
          beforeValue: before as Prisma.InputJsonValue,
          afterValue: after
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
  res.status(500).json({
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
