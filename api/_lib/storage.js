const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");

let pool;
let schemaReady = false;

function getStorageMode() {
  if (process.env.POSTGRES_URL) return "postgres";
  if (process.env.VERCEL) return "tmp-file";
  return "local-file";
}

function getFilePath() {
  if (getStorageMode() === "tmp-file") {
    return path.join("/tmp", "agrex-store.json");
  }

  return path.join(process.cwd(), "data", "agrex-store.json");
}

async function ensureFileStore() {
  const filePath = getFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify({ participants: [], sponsors: [] }, null, 2), "utf8");
  }
  return filePath;
}

async function readFileStore() {
  const filePath = await ensureFileStore();
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeFileStore(data) {
  const filePath = await ensureFileStore();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  }
  return pool;
}

async function ensurePostgresSchema() {
  if (schemaReady) return;
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agrex_registrations (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        code TEXT NOT NULL,
        status TEXT NOT NULL,
        payload JSONB NOT NULL,
        sponsor_package_id TEXT,
        amount_eur INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        payment_confirmed_at TIMESTAMPTZ
      )
    `);
    schemaReady = true;
  } finally {
    client.release();
  }
}

async function saveParticipant(record) {
  if (getStorageMode() === "postgres") {
    await ensurePostgresSchema();
    await getPool().query(
      `INSERT INTO agrex_registrations (id, kind, code, status, payload, amount_eur)
       VALUES ($1, 'participant', $2, $3, $4::jsonb, 0)`,
      [record.id, record.code, record.status, JSON.stringify(record)]
    );
    return;
  }

  const store = await readFileStore();
  store.participants.push(record);
  await writeFileStore(store);
}

async function saveSponsor(record) {
  if (getStorageMode() === "postgres") {
    await ensurePostgresSchema();
    await getPool().query(
      `INSERT INTO agrex_registrations (id, kind, code, status, payload, sponsor_package_id, amount_eur)
       VALUES ($1, 'sponsor', $2, $3, $4::jsonb, $5, $6)`,
      [record.id, record.code, record.status, JSON.stringify(record), record.sponsorPackageId, record.amountEur]
    );
    return;
  }

  const store = await readFileStore();
  store.sponsors.push(record);
  await writeFileStore(store);
}

async function listRecords() {
  if (getStorageMode() === "postgres") {
    await ensurePostgresSchema();
    const result = await getPool().query(
      `SELECT kind, payload
       FROM agrex_registrations
       ORDER BY created_at DESC`
    );
    const participants = [];
    const sponsors = [];
    for (const row of result.rows) {
      if (row.kind === "participant") participants.push(row.payload);
      if (row.kind === "sponsor") sponsors.push(row.payload);
    }
    return { participants, sponsors };
  }

  return readFileStore();
}

async function getSponsorById(id) {
  const { sponsors } = await listRecords();
  return sponsors.find((item) => item.id === id) || null;
}

async function updateSponsor(record) {
  if (getStorageMode() === "postgres") {
    await ensurePostgresSchema();
    await getPool().query(
      `UPDATE agrex_registrations
       SET status = $2,
           payload = $3::jsonb,
           updated_at = NOW(),
           payment_confirmed_at = $4
       WHERE id = $1`,
      [record.id, record.status, JSON.stringify(record), record.paymentConfirmedAt || null]
    );
    return;
  }

  const store = await readFileStore();
  const index = store.sponsors.findIndex((item) => item.id === record.id);
  if (index === -1) {
    throw new Error("Sponsor not found");
  }
  store.sponsors[index] = record;
  await writeFileStore(store);
}

module.exports = {
  getStorageMode,
  saveParticipant,
  saveSponsor,
  listRecords,
  getSponsorById,
  updateSponsor
};
