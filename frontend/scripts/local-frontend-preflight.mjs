import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const FRONTEND_ROOT = process.cwd();
const DEFAULT_PORT = Number(process.env.PORT || 3000);

function readEnvFileValue(filePath, key) {
  if (!fs.existsSync(filePath)) return undefined;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;

    const currentKey = line.slice(0, index).trim();
    if (currentKey !== key) continue;

    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }

  return undefined;
}

function checkNodeModules() {
  const nodeModulesPath = path.join(FRONTEND_ROOT, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    return {
      ok: false,
      message: 'Missing node_modules. Run "npm install" in TeleHealthx frontend before starting frontend.',
    };
  }
  return { ok: true };
}

function checkBackendUrlSyntax() {
  const configured =
    process.env.NEXT_SERVER_API_URL ||
    readEnvFileValue(path.join(FRONTEND_ROOT, '.env.local'), 'NEXT_SERVER_API_URL') ||
    readEnvFileValue(path.join(FRONTEND_ROOT, '.env'), 'NEXT_SERVER_API_URL');
  if (!configured) {
    return { ok: true };
  }

  try {
    const parsed = new URL(configured);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        ok: false,
        message: 'NEXT_SERVER_API_URL must start with http:// or https://',
      };
    }
  } catch {
    return {
      ok: false,
      message: 'NEXT_SERVER_API_URL is not a valid URL.',
    };
  }

  return { ok: true };
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

function cleanupStaleNextLockIfSafe(portAvailable) {
  const lockPath = path.join(FRONTEND_ROOT, '.next', 'dev', 'lock');
  if (!fs.existsSync(lockPath)) {
    return;
  }

  if (!portAvailable) {
    return;
  }

  try {
    fs.unlinkSync(lockPath);
    console.log('[preflight:frontend] Removed stale .next/dev/lock file.');
  } catch (error) {
    console.warn(`[preflight:frontend] Could not remove lock file: ${error.message}`);
  }
}

async function main() {
  const checks = [checkNodeModules(), checkBackendUrlSyntax()];

  for (const check of checks) {
    if (!check.ok) {
      console.error(`[preflight:frontend] ${check.message}`);
      process.exit(1);
    }
  }

  const portAvailable = await checkPortAvailable(DEFAULT_PORT);

  cleanupStaleNextLockIfSafe(portAvailable);

  if (!portAvailable) {
    console.error(`[preflight:frontend] Port ${DEFAULT_PORT} is already in use.`);
    console.error('[preflight:frontend] Tip: stop existing Next dev process or run "npm run local:free-port" in TeleHealthx frontend.');
    process.exit(1);
  }

  console.log(`[preflight:frontend] OK. Frontend can start on port ${DEFAULT_PORT}.`);
}

main().catch((error) => {
  console.error('[preflight:frontend] Unexpected error:', error.message);
  process.exit(1);
});
