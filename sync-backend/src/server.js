import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import Database from 'better-sqlite3';

const ENTITY_TYPES = new Set(['product', 'storageLocation', 'consumptionLog']);
const OPERATIONS = new Set(['upsert', 'delete']);

function nowIso() {
  return new Date().toISOString();
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function parseDateScore(value) {
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return 0;
  return ms;
}

export function shouldApplyChange(current, incomingUpdatedAt, incomingDeviceId) {
  if (!current) return true;
  const currentScore = parseDateScore(current.updated_at);
  const incomingScore = parseDateScore(incomingUpdatedAt);
  if (incomingScore > currentScore) return true;
  if (incomingScore < currentScore) return false;
  return String(incomingDeviceId) > String(current.updated_by_device_id);
}

function resolveDbPath(dbPath) {
  let resolvedDbPath = dbPath;
  try {
    fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });
  } catch {
    resolvedDbPath = path.resolve(process.cwd(), 'data/sync.db');
    fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });
  }
  return resolvedDbPath;
}

function initDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  sync_code_hash TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entities (
  household_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  updated_by_device_id TEXT NOT NULL,
  PRIMARY KEY (household_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL,
  payload_json TEXT,
  updated_at TEXT NOT NULL,
  updated_by_device_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_household ON devices(household_id);
CREATE INDEX IF NOT EXISTS idx_entities_household_updated ON entities(household_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_changes_household_seq ON changes(household_id, seq);
`);
  return db;
}

function parseCorsOrigins(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createServer(options = {}) {
  const port = Number.parseInt(String(options.port ?? process.env.PORT ?? '8787'), 10);
  const requestedDbPath = String(options.dbPath ?? process.env.DB_PATH ?? '/data/sync.db');
  const corsOrigins = Array.isArray(options.corsOrigins)
    ? options.corsOrigins
    : parseCorsOrigins(options.corsOrigins ?? process.env.CORS_ORIGINS ?? '');
  const logger = options.logger === true;

  const resolvedDbPath = resolveDbPath(requestedDbPath);
  const db = initDb(resolvedDbPath);

  const findHouseholdByCode = db.prepare(
    'SELECT id FROM households WHERE sync_code_hash = ? LIMIT 1'
  );
  const insertHousehold = db.prepare(
    'INSERT INTO households (id, sync_code_hash, created_at) VALUES (?, ?, ?)'
  );
  const insertDevice = db.prepare(
    `INSERT INTO devices (id, household_id, device_name, token_hash, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const findDeviceByToken = db.prepare(
    `SELECT id, household_id, device_name
     FROM devices
     WHERE token_hash = ? AND household_id = ?
     LIMIT 1`
  );
  const touchDevice = db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?');
  const readEntity = db.prepare(
    `SELECT updated_at, updated_by_device_id
     FROM entities
     WHERE household_id = ? AND entity_type = ? AND entity_id = ?`
  );
  const upsertEntity = db.prepare(
    `INSERT INTO entities (
        household_id, entity_type, entity_id, payload_json, updated_at, deleted_at, updated_by_device_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(household_id, entity_type, entity_id)
     DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        updated_by_device_id = excluded.updated_by_device_id`
  );
  const appendChange = db.prepare(
    `INSERT INTO changes (
        household_id, entity_type, entity_id, op, payload_json, updated_at, updated_by_device_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const readChangesSince = db.prepare(
    `SELECT seq, entity_type, entity_id, op, payload_json, updated_at, updated_by_device_id
     FROM changes
     WHERE household_id = ? AND seq > ?
     ORDER BY seq ASC
     LIMIT ?`
  );

  const app = Fastify({
    logger,
    bodyLimit: 15 * 1024 * 1024,
  });

  app.decorateRequest('syncContext', null);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (corsOrigins.length === 0) {
        cb(null, true);
        return;
      }
      cb(null, corsOrigins.includes(origin));
    },
  });

  app.get('/health', async () => {
    return {
      ok: true,
      time: nowIso(),
      dbPath: resolvedDbPath,
    };
  });

  app.post('/v1/pair', async (request, reply) => {
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const syncCode = typeof body.syncCode === 'string' ? body.syncCode.trim() : '';
    const deviceName = typeof body.deviceName === 'string' ? body.deviceName.trim() : '';

    if (syncCode.length < 4 || deviceName.length < 2) {
      reply.code(400);
      return { error: 'syncCode und deviceName sind erforderlich.' };
    }

    const syncCodeHash = hashValue(syncCode);
    let household = findHouseholdByCode.get(syncCodeHash);
    if (!household) {
      household = { id: crypto.randomUUID() };
      insertHousehold.run(household.id, syncCodeHash, nowIso());
    }

    const deviceId = crypto.randomUUID();
    const token = randomToken();
    const tokenHash = hashValue(token);
    const now = nowIso();

    insertDevice.run(deviceId, household.id, deviceName, tokenHash, now, now);

    return {
      householdId: household.id,
      deviceId,
      deviceToken: token,
    };
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/v1/sync/')) {
      return;
    }

    const authHeader = request.headers.authorization || '';
    const householdId = String(request.headers['x-household-id'] || '').trim();

    if (!authHeader.startsWith('Bearer ') || !householdId) {
      reply.code(401);
      throw new Error('Nicht autorisiert.');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const tokenHash = hashValue(token);
    const device = findDeviceByToken.get(tokenHash, householdId);

    if (!device) {
      reply.code(401);
      throw new Error('Ungültiges Gerätetoken.');
    }

    touchDevice.run(nowIso(), device.id);
    request.syncContext = {
      deviceId: device.id,
      householdId: device.household_id,
    };
  });

  app.post('/v1/sync/push', async (request, reply) => {
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const incomingChanges = Array.isArray(body.changes) ? body.changes : [];
    if (incomingChanges.length > 1000) {
      reply.code(400);
      return { error: 'Zu viele Änderungen in einem Request.' };
    }

    const { householdId, deviceId } = request.syncContext;
    let applied = 0;

    const applyTransaction = db.transaction((changes) => {
      for (const rawChange of changes) {
        if (!rawChange || typeof rawChange !== 'object') continue;
        const entityType = String(rawChange.entityType || '');
        const entityId = String(rawChange.entityId || '');
        const op = String(rawChange.op || '');
        const updatedAt = String(rawChange.updatedAt || '');

        if (!ENTITY_TYPES.has(entityType)) continue;
        if (!OPERATIONS.has(op)) continue;
        if (!entityId || !updatedAt) continue;

        const payload =
          op === 'upsert' && rawChange.payload && typeof rawChange.payload === 'object'
            ? JSON.stringify(rawChange.payload)
            : null;

        const current = readEntity.get(householdId, entityType, entityId);
        if (!shouldApplyChange(current, updatedAt, deviceId)) {
          continue;
        }

        const deletedAt = op === 'delete' ? updatedAt : null;
        upsertEntity.run(
          householdId,
          entityType,
          entityId,
          payload,
          updatedAt,
          deletedAt,
          deviceId
        );
        appendChange.run(
          householdId,
          entityType,
          entityId,
          op,
          payload,
          updatedAt,
          deviceId,
          nowIso()
        );
        applied += 1;
      }
    });

    applyTransaction(incomingChanges);

    return {
      received: incomingChanges.length,
      applied,
    };
  });

  app.get('/v1/sync/pull', async (request) => {
    const query = request.query && typeof request.query === 'object' ? request.query : {};
    const rawCursor = Number.parseInt(String(query.cursor || '0'), 10);
    const cursor = Number.isFinite(rawCursor) && rawCursor >= 0 ? rawCursor : 0;
    const { householdId } = request.syncContext;

    const rows = readChangesSince.all(householdId, cursor, 1000);
    let nextCursor = cursor;

    const changes = rows.map((row) => {
      nextCursor = Math.max(nextCursor, row.seq);
      return {
        seq: row.seq,
        entityType: row.entity_type,
        entityId: row.entity_id,
        op: row.op,
        updatedAt: row.updated_at,
        updatedByDeviceId: row.updated_by_device_id,
        payload: row.payload_json ? JSON.parse(row.payload_json) : null,
      };
    });

    return {
      cursor: nextCursor,
      changes,
    };
  });

  app.setErrorHandler((error, _request, reply) => {
    if (!reply.sent) {
      reply.code(reply.statusCode >= 400 ? reply.statusCode : 500).send({
        error: error.message || 'Serverfehler',
      });
    }
  });

  app.addHook('onClose', async () => {
    db.close();
  });

  return {
    app,
    port,
    resolvedDbPath,
  };
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const { app, port } = await createServer({
    port: process.env.PORT,
    dbPath: process.env.DB_PATH,
    corsOrigins: process.env.CORS_ORIGINS,
    logger: true,
  });
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
