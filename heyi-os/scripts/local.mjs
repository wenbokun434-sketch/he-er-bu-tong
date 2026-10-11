import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from './sites-env.mjs';

export const wrangler = path.join(projectRoot, 'node_modules/wrangler/bin/wrangler.js');
export const defaultState = path.join(projectRoot, '.wrangler/state');

// This generated configuration is local-only. Resolve build-relative paths
// before moving the configuration into ignored checkout-local storage.
export function localConfig() {
  const buildDir = path.join(projectRoot, 'dist/server');
  const source = path.join(buildDir, 'wrangler.json');
  if (!existsSync(source)) throw new Error('Run npm run setup first (a production build is required).');
  const config = JSON.parse(readFileSync(source, 'utf8'));
  config.main = path.resolve(buildDir, config.main);
  if (config.assets?.directory) config.assets.directory = path.resolve(buildDir, config.assets.directory);
  for (const database of config.d1_databases ?? []) {
    database.migrations_dir = path.join(projectRoot, 'drizzle');
  }
  const directory = path.join(projectRoot, '.sites-runtime');
  mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, 'local-wrangler.json');
  writeFileSync(destination, JSON.stringify(config, null, 2) + '\n');
  return destination;
}

export function environmentFile({ withoutSecrets = false } = {}) {
  const local = path.join(projectRoot, '.env.local');
  return !withoutSecrets && existsSync(local) ? local : path.join(projectRoot, '.env.example');
}

export function migrate(stateDirectory = defaultState) {
  const result = spawnSync(process.execPath, [
    wrangler, 'd1', 'migrations', 'apply', 'DB', '--local',
    '--config', localConfig(), '--persist-to', stateDirectory,
    '--env-file', environmentFile({ withoutSecrets: true }),
  ], { cwd: projectRoot, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, CI: 'true' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Local database migration failed. Existing data was not reset.');
}

export function startArgs({ stateDirectory = defaultState, port = 5173, withoutSecrets = false } = {}) {
  if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid local port.');
  return [wrangler, 'dev', '--config', localConfig(), '--local',
    '--persist-to', stateDirectory, '--ip', '127.0.0.1', '--port', String(port),
    '--inspector-port', '0', '--env-file', environmentFile({ withoutSecrets }), '--log-level', 'warn'];
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [command, ...extra] = process.argv.slice(2);
    if (extra.length && (command !== 'start' || extra.length !== 2 || extra[0] !== '--port')) {
      throw new Error('Usage: npm start [-- --port 5174] / npm run db:migrate');
    }
    if (command === 'migrate') migrate();
    else if (command === 'start') {
      const port = extra[1] ?? 5173;
      console.log(`HeYi OS: http://127.0.0.1:${port} (local only; Ctrl+C to stop)`);
      const worker = spawn(process.execPath, startArgs({ port }), { cwd: projectRoot, stdio: 'inherit' });
      const stop = signal => worker.kill(signal);
      const stopInterrupt = () => stop('SIGINT');
      const stopTerminate = () => stop('SIGTERM');
      process.on('SIGINT', stopInterrupt);
      process.on('SIGTERM', stopTerminate);
      process.exitCode = await new Promise((resolve, reject) => {
        worker.once('error', reject);
        worker.once('exit', (code, signal) => resolve(code ?? (signal ? 0 : 1)));
      });
      process.off('SIGINT', stopInterrupt);
      process.off('SIGTERM', stopTerminate);
    } else throw new Error('Expected start or migrate.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
