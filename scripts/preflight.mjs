import fs from 'node:fs';
import path from 'node:path';

const envName = process.env.APP_ENV || process.env.EXPO_PUBLIC_APP_ENV || 'development';

function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    values[trimmed.slice(0, index)] = trimmed.slice(index + 1).trim();
  }
  return values;
}

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      const text = fs.readFileSync(full, 'utf8');
      if (/console\.(log|debug|info)\(/.test(text)) found.push(full);
    }
  }
  return found;
}

const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_PAYMENTS_MODE'];
const logs = walk('src');
let failed = false;

if (logs.length) {
  console.error('Debug logs found:');
  logs.forEach((file) => console.error(`- ${file}`));
  failed = true;
} else {
  console.log('No console.log/debug/info in src.');
}

if (envName !== 'production') {
  console.log(`Preflight ${envName}: production variable check skipped.`);
  process.exit(failed ? 1 : 0);
}

const fileValues = parseEnv('.env.production');
const values = { ...fileValues, ...process.env };
for (const key of required) {
  if (!values[key]) {
    console.error(`${key} is empty`);
    failed = true;
  }
}
if (String(values.EXPO_PUBLIC_SUPABASE_URL || '').includes('localhost')) {
  console.error('Production Supabase URL points at localhost');
  failed = true;
}
if (values.EXPO_PUBLIC_PAYMENTS_MODE !== 'live') {
  console.error('EXPO_PUBLIC_PAYMENTS_MODE must be live for production');
  failed = true;
}

if (failed) process.exit(1);
console.log('Production preflight passed. Babel strips console calls when EXPO_PUBLIC_APP_ENV=production.');
