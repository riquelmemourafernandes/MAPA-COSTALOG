import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import multer from "multer";
import ExcelJS from "exceljs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ImportStatus, Prisma, PrismaClient, UserRole } from "@prisma/client";
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


const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const valid = /\.xlsx?$/i.test(file.originalname);
    if (!valid) return callback(new Error("Envie um arquivo Excel .xlsx ou .xls."));
    return callback(null, true);
  }
});

function excelColumnKey(index: number): string {
  let n = index + 1;
  let key = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    key = String.fromCharCode(65 + remainder) + key;
    n = Math.floor((n - 1) / 26);
  }
  return key;
}

async function parseMapaWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets.find((sheet) => sheet.name.trim().toLocaleUpperCase("pt-BR") === "MAPA 1.0");
  if (!worksheet) throw new Error('A aba "MAPA 1.0" não foi encontrada no arquivo.');
  if (worksheet.rowCount < 1) throw new Error('A aba "MAPA 1.0" está vazia.');

  const headerRow = worksheet.getRow(1);
  const headers = Array.from({ length: worksheet.columnCount }, (_, index) => ({
    key: excelColumnKey(index),
    label: String(headerRow.getCell(index + 1).text ?? "").trim()
  }));
  const labels = new Set(headers.map((item) => item.label.toLocaleUpperCase("pt-BR")));
  const headerKey = (label: string) => headers.find((item) => item.label.toLocaleUpperCase("pt-BR") === label)?.key;
  const containerKey = headerKey("CONTAINER");
  const statusKey = headerKey("STATUS");
  const clientKey = headerKey("CLIENTE");
  const cteKey = headerKey("CTE");
  const missing = ["DATA", "CTE", "CLIENTE", "CONTAINER"].filter((label) => !labels.has(label));
  if (missing.length) throw new Error("Cabeçalhos obrigatórios não reconhecidos: " + missing.join(", "));

  const parsedRows: Array<{ data: Record<string, string | number | boolean>; excelRow: number }> = [];
  const errors: Array<{ row: number; message: string }> = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const data: Record<string, string | number | boolean> = {};
    for (let columnNumber = 1; columnNumber <= headers.length; columnNumber++) {
      const cell = row.getCell(columnNumber);
      let value: unknown = cell.value;
      if (value === null || value === undefined || value === "") continue;
      if (value instanceof Date) {
        value = cell.text || value.toISOString();
      } else if (typeof value === "object") {
        const structured = value as { result?: unknown; text?: string; richText?: Array<{ text: string }> };
        if ("result" in structured && structured.result !== undefined) value = structured.result;
        else if (structured.text !== undefined) value = structured.text;
        else if (structured.richText) value = structured.richText.map((part) => part.text).join("");
        else value = cell.text || "";
      }
      if (value === null || value === undefined || value === "") continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") data[headers[columnNumber - 1].key] = value;
      else data[headers[columnNumber - 1].key] = String(value);
    }
    if (!Object.keys(data).length) continue;
    const containerValue = containerKey ? data[containerKey] : undefined;
    if (typeof containerValue === "string" && containerValue.length > 32) {
      errors.push({ row: rowNumber, message: "Container excede 32 caracteres." });
    }
    parsedRows.push({ data, excelRow: rowNumber });
  }
  return {
    parsedRows, errors, sheetName: worksheet.name, headers, headerKey,
    statusKey, clientKey, containerKey, cteKey,
    sourceRowCount: Math.max(0, worksheet.rowCount - 1)
  };
}

app.post("/api/v1/imports/preview", requireRole(UserRole.ADMIN, UserRole.SUPERVISOR), uploadXlsx.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: { code: "FILE_REQUIRED", message: "Selecione um arquivo Excel." } });
    const fileHash = createHash("sha256").update(req.file.buffer).digest("hex");
    const duplicate = await prisma.importJob.findFirst({ where: { fileHash, status: ImportStatus.IMPORTED } });
    if (duplicate) return res.status(409).json({ error: { code: "DUPLICATE_IMPORT", message: "Este arquivo já foi importado.", importId: duplicate.id } });
    let parsed: Awaited<ReturnType<typeof parseMapaWorkbook>>;
    try {
      parsed = await parseMapaWorkbook(req.file.buffer);
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : "";
      const known = /aba|Cabeçalhos|vazia/i.test(message);
      return res.status(400).json({
        error: {
          code: "INVALID_WORKBOOK",
          message: known ? message : "O arquivo não é um Excel válido ou está corrompido."
        }
      });
    }
    const job = await prisma.importJob.create({
      data: {
        fileName: req.file.originalname.slice(0, 255), fileHash,
        status: parsed.errors.length ? ImportStatus.FAILED : ImportStatus.READY,
        totalRows: parsed.parsedRows.length, validRows: parsed.parsedRows.length - parsed.errors.length,
        rejectedRows: parsed.errors.length, createdById: req.authUser!.id,
        summary: { sheetName: parsed.sheetName, sourceRowCount: parsed.sourceRowCount, columnCount: parsed.headers.length },
        errors: parsed.errors.slice(0, 200)
      }
    });
    return res.json({
      importId: job.id, status: job.status, fileName: job.fileName, fileHash,
      sheet: parsed.sheetName, sourceRowCount: parsed.sourceRowCount, rowsDetected: parsed.parsedRows.length,
      validRows: parsed.parsedRows.length - parsed.errors.length, rejectedRows: parsed.errors.length,
      errors: parsed.errors.slice(0, 50), columns: parsed.headers.filter((item) => item.label).slice(0, 140),
      sample: parsed.parsedRows.slice(0, 10).map((row) => ({ excelRow: row.excelRow, data: row.data }))
    });
  } catch (error) {
    if (error instanceof Error && /aba|Cabeçalhos|vazia/.test(error.message)) {
      return res.status(400).json({ error: { code: "INVALID_WORKBOOK", message: error.message } });
    }
    return next(error);
  }
});

app.post("/api/v1/imports/:id/commit", requireRole(UserRole.ADMIN), uploadXlsx.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: { code: "FILE_REQUIRED", message: "Envie novamente o mesmo arquivo usado na prévia." } });
    const job = await prisma.importJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: { code: "IMPORT_NOT_FOUND", message: "Prévia de importação não encontrada." } });
    if (job.status !== ImportStatus.READY) return res.status(409).json({ error: { code: "IMPORT_NOT_READY", message: "A prévia não está liberada para importação." } });
    const fileHash = createHash("sha256").update(req.file.buffer).digest("hex");
    if (fileHash !== job.fileHash) return res.status(409).json({ error: { code: "FILE_MISMATCH", message: "O arquivo difere daquele validado na prévia." } });
    if (await prisma.importJob.findFirst({ where: { fileHash, status: ImportStatus.IMPORTED } })) {
      return res.status(409).json({ error: { code: "DUPLICATE_IMPORT", message: "Este arquivo já foi importado." } });
    }
    let parsed: Awaited<ReturnType<typeof parseMapaWorkbook>>;
    try {
      parsed = await parseMapaWorkbook(req.file.buffer);
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : "";
      const known = /aba|Cabeçalhos|vazia/i.test(message);
      return res.status(400).json({
        error: {
          code: "INVALID_WORKBOOK",
          message: known ? message : "O arquivo não é um Excel válido ou está corrompido."
        }
      });
    }
    if (parsed.errors.length) return res.status(400).json({ error: { code: "IMPORT_VALIDATION_FAILED", message: "O arquivo contém erros; gere uma nova prévia." }, errors: parsed.errors.slice(0, 50) });
    const now = new Date();
    const rows = parsed.parsedRows.map(({ data }) => ({
      data: data as Prisma.InputJsonObject,
      status: parsed.statusKey && typeof data[parsed.statusKey] === "string" ? data[parsed.statusKey] as string : null,
      clientName: parsed.clientKey && typeof data[parsed.clientKey] === "string" ? data[parsed.clientKey] as string : null,
      container: parsed.containerKey && typeof data[parsed.containerKey] === "string" ? data[parsed.containerKey] as string : null,
      cte: parsed.cteKey && data[parsed.cteKey] !== undefined ? String(data[parsed.cteKey]) : null,
      updatedById: req.authUser!.id, createdAt: now, updatedAt: now
    }));
    await prisma.$transaction(async (tx) => {
      for (let offset = 0; offset < rows.length; offset += 400) {
        await tx.mapaRow.createMany({ data: rows.slice(offset, offset + 400) });
      }
      await tx.importJob.update({
        where: { id: job.id },
        data: { status: ImportStatus.IMPORTED, totalRows: rows.length, validRows: rows.length, rejectedRows: 0, finishedAt: new Date() }
      });
      await tx.auditLog.create({
        data: { entityType: "IMPORT_JOB", entityId: job.id, action: "IMPORT", fieldKey: "MAPA 1.0",
          afterValue: { rowsImported: rows.length, fileHash }, userId: req.authUser!.id }
      });
    });
    return res.json({ importId: job.id, status: "IMPORTED", rowsImported: rows.length });
  } catch (error) {
    return next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Upload validation failures are client errors, not generic server failures.
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
        message: tooLarge ? "O arquivo excede o limite de 50 MB." : "Não foi possível receber o arquivo."
      }
    });
  }
  if (error instanceof Error && error.message === "Envie um arquivo Excel .xlsx ou .xls.") {
    return res.status(400).json({ error: { code: "INVALID_FILE_TYPE", message: error.message } });
  }
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
