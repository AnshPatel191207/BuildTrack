import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Offline persistence layer.
 *
 * - SQLite (`expo-sqlite`) holds the durable write queue ("outbox") and a
 *   dashboard snapshot so the app survives restarts offline.
 * - AsyncStorage keeps lightweight read caches (see services/api.ts) and
 *   small preferences.
 *
 * On web (where expo-sqlite is unavailable in Expo Go) the outbox degrades to
 * an in-memory queue for the current session.
 */

type SqliteDb = {
  execAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
  runAsync: (sql: string, params?: unknown[]) => Promise<{ lastInsertRowId?: number }>;
  getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
};

let db: SqliteDb | null = null;
const memoryOutbox: OutboxEntry[] = [];
let memoryId = 1;

export interface OutboxEntry {
  id: number;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body: string | null;
  label: string;
  createdAt: number;
}

async function getDb(): Promise<SqliteDb | null> {
  if (Platform.OS === 'web') return null;
  if (db) return db;
  try {
    const sqlite = await import('expo-sqlite');
    const opened = sqlite.openDatabaseSync('buildtrack.db');
    opened.execSync(`
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        body TEXT,
        label TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS kv_cache (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    db = opened as unknown as SqliteDb;
    return db;
  } catch {
    // SQLite unavailable — fall back to memory queue for this session.
    return null;
  }
}

// ── Outbox (queued writes while offline) ─────────────────────────

export async function enqueueMutation(entry: {
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body: unknown;
  label: string;
}): Promise<void> {
  const database = await getDb();
  const body = entry.body == null ? null : JSON.stringify(entry.body);
  if (database) {
    await database.runAsync(
      'INSERT INTO outbox (method, url, body, label, created_at) VALUES (?, ?, ?, ?, ?)',
      [entry.method, entry.url, body, entry.label, Date.now()],
    );
  } else {
    memoryOutbox.push({
      id: memoryId++,
      method: entry.method,
      url: entry.url,
      body,
      label: entry.label,
      createdAt: Date.now(),
    });
  }
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  const database = await getDb();
  if (!database) return [...memoryOutbox];
  try {
    const rows = await database.getAllAsync<{
      id: number;
      method: string;
      url: string;
      body: string | null;
      label: string;
      created_at: number;
    }>('SELECT * FROM outbox ORDER BY created_at ASC');
    return rows.map((r) => ({
      id: r.id,
      method: r.method as OutboxEntry['method'],
      url: r.url,
      body: r.body,
      label: r.label,
      createdAt: r.created_at,
    }));
  } catch {
    return [...memoryOutbox];
  }
}

export async function removeOutboxEntry(id: number): Promise<void> {
  const database = await getDb();
  if (database) {
    await database.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
  }
  const idx = memoryOutbox.findIndex((e) => e.id === id);
  if (idx >= 0) memoryOutbox.splice(idx, 1);
}

export async function countOutbox(): Promise<number> {
  const database = await getDb();
  if (!database) return memoryOutbox.length;
  try {
    const rows = await database.getAllAsync<{ n: number }>('SELECT COUNT(*) as n FROM outbox');
    return rows[0]?.n ?? 0;
  } catch {
    return memoryOutbox.length;
  }
}

export async function clearOutbox(): Promise<void> {
  const database = await getDb();
  if (database) await database.runAsync('DELETE FROM outbox');
  memoryOutbox.length = 0;
}

// ── Durable KV snapshot (dashboard etc.) ─────────────────────────

export async function kvSet(key: string, payload: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(`bt.kv.${key}`, JSON.stringify({ t: Date.now(), d: payload }));
  } catch {
    // storage full/unavailable — non-fatal
  }
}

export async function kvGet<T>(key: string): Promise<{ t: number; d: T } | null> {
  try {
    const raw = await AsyncStorage.getItem(`bt.kv.${key}`);
    return raw ? (JSON.parse(raw) as { t: number; d: T }) : null;
  } catch {
    return null;
  }
}
