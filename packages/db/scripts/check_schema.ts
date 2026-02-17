import Database from 'bun:sqlite';

const db = new Database('buddy-wallet.sqlite');

console.log('=== Users table columns ===');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const userCols = db.query('PRAGMA table_info(users)').all() as any[];
userCols.forEach((c) => {
  console.log(`  ${c.name}: ${c.type}`);
});

console.log('\n=== Sessions table columns ===');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sessionCols = db.query('PRAGMA table_info(sessions)').all() as any[];
sessionCols.forEach((c) => {
  console.log(`  ${c.name}: ${c.type}`);
});

console.log('\n=== Schema Summary ===');
console.log(`Users table: ${userCols.length} columns`);
console.log(`Sessions table: ${sessionCols.length} columns`);

const userNames = userCols.map((c) => c.name);
const sessionNames = sessionCols.map((c) => c.name);

// Verify critical columns
const criticalUsers = ['is_locked', 'email_verified', 'phone_verified', 'session_version'];
const criticalSessions = ['status', 'deleted_at', 'device_name', 'location'];

const missingUsers = criticalUsers.filter((c) => !userNames.includes(c));
const missingSessions = criticalSessions.filter((c) => !sessionNames.includes(c));

if (missingUsers.length > 0) {
  console.log(`[FAIL] Users missing: ${missingUsers.join(', ')}`);
} else {
  console.log('[OK] Users table: all critical columns present');
}

if (missingSessions.length > 0) {
  console.log(`[FAIL] Sessions missing: ${missingSessions.join(', ')}`);
} else {
  console.log('[OK] Sessions table: all critical columns present');
}

if (missingUsers.length === 0 && missingSessions.length === 0) {
  console.log('\n[OK] Database schema is complete and ready!');
}
