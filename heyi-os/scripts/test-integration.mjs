import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { once } from 'node:events';
import { projectRoot } from './sites-env.mjs';
import { migrate, startArgs } from './local.mjs';

// No user database or paid API is used. Each run has independent local storage.
const testRoot = mkdtempSync(path.join(projectRoot, '.sites-runtime/integration-'));
const stateDirectory = path.join(testRoot, 'state');
const safeEnv = { ...process.env, ACCTOKEN_API_KEY: '', CI: 'true' };
const allocate = createServer();
await new Promise(resolve => allocate.listen(0, '127.0.0.1', resolve));
const port = allocate.address().port;
await new Promise(resolve => allocate.close(resolve));
const base = `http://127.0.0.1:${port}`;
let worker;

try {
  migrate(stateDirectory);
  migrate(stateDirectory); // Re-running migrations must be safe.
  worker = spawn(process.execPath, startArgs({ stateDirectory, port, withoutSecrets: true }), {
    cwd: projectRoot, env: safeEnv, stdio: ['ignore', 'inherit', 'inherit'],
  });
  worker.on('error', error => console.error(error.message));
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (worker.exitCode !== null) throw new Error('Local test server stopped before readiness.');
    try {
      ready = (await fetch(base + '/api/collaboration', { signal: AbortSignal.timeout(1000) })).ok;
    } catch { /* Allow the worker to initialize. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Local test server did not become ready.');
  assert.equal((await fetch(base)).status, 200);
  const assistant = await (await fetch(base + '/api/assistant?caseId=openair')).json();
  assert.equal(assistant.configured, false, 'Tests must not use an API key.');
  const noKey = await fetch(base + '/api/assistant', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ caseId: 'openair', actorKey: 'coordinator', prompt: '测试未配置密钥时的明确提示',
      requestId: crypto.randomUUID(), shareConfirmed: true, consentVersion: 'acctoken-deepseek-v1' }),
  });
  assert.equal(noKey.status, 503);
  assert.match((await noKey.json()).error, /尚未配置/);
  for (const file of ['collaboration-api.mjs', 'difference-graph-api.mjs', 'cases-api.mjs', 'workflow-api.mjs']) {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', path.join(projectRoot, 'tests', file)], {
      cwd: projectRoot, env: { ...safeEnv, HEYI_TEST_URL: base }, stdio: 'inherit',
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${file} failed`);
  }
  console.log('PASS: clean local setup, idempotent migrations, page, missing-key behavior, collaboration, map, cases, document export and commitment tracking.');
} finally {
  if (worker && worker.exitCode === null) {
    const exited = once(worker, 'exit');
    worker.kill('SIGTERM');
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
  }
  console.log(`Isolated test data retained for inspection: ${testRoot}`);
}
