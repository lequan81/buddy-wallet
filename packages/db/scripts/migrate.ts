#!/usr/bin/env bun
/**
 * Custom migration runner for Bun's native sqlite
 * Since Bun 1.3.5 uses native sqlite and Drizzle Kit expects BetterSQLite3,
 * we need a custom runner that works with Bun.sql() API
 */

import fs from 'fs';
import path from 'path';
import Database from 'bun:sqlite';

const DATABASE_URL = process.env.DATABASE_URL || 'buddy-wallet.sqlite';
const MIGRATIONS_DIR = './drizzle';
const JOURNAL_FILE = path.join(MIGRATIONS_DIR, 'meta', '_journal.json');

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

function readJournal(): Journal {
  if (!fs.existsSync(JOURNAL_FILE)) {
    return { version: '7', dialect: 'sqlite', entries: [] };
  }
  try {
    const content = fs.readFileSync(JOURNAL_FILE, 'utf-8').trim();
    return content ? JSON.parse(content) : { version: '7', dialect: 'sqlite', entries: [] };
  } catch (e) {
    return { version: '7', dialect: 'sqlite', entries: [] };
  }
}

function writeJournal(journal: Journal) {
  fs.writeFileSync(JOURNAL_FILE, JSON.stringify(journal, null, 2) + '\n');
}

function getMigrationFiles(): string[] {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
  return files.sort();
}

async function runMigrations() {
  const db = new Database(DATABASE_URL);
  const journal = readJournal();
  const migrationFiles = getMigrationFiles();
  const appliedTags = new Set(journal.entries.map(e => e.tag));

  let hasChanges = false;

  for (const file of migrationFiles) {
    const tag = file.replace('.sql', '');

    if (appliedTags.has(tag)) {
      console.log(`[OK] ${tag} (already applied)`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Split by statement-breakpoint comments (Drizzle style)
    const statements = sql
      .split('--> statement-breakpoint')
      .map(s => {
        // Remove leading comments and trim
        const lines = s.trim().split('\n');
        const sqlLines = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        });
        return sqlLines.join('\n').trim();
      })
      .filter(s => s.length > 0);

    try {
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`  Executing: ${statement.substring(0, 50)}...`);
          db.exec(statement);
        }
      }

      // Record in journal
      const newEntry: JournalEntry = {
        idx: journal.entries.length,
        version: '6',
        when: Date.now(),
        tag,
        breakpoints: true
      };
      journal.entries.push(newEntry);
      appliedTags.add(tag);
      hasChanges = true;

      console.log(`[OK] ${tag}`);
    } catch (error) {
      console.error(`[FAIL] ${tag}`);
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  if (hasChanges) {
    writeJournal(journal);
  }

  console.log(hasChanges ? '\n[OK] Migrations applied successfully' : '\n[OK] No migrations to apply');
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
