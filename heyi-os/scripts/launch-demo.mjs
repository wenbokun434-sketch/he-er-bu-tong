import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const logDir = path.join(projectRoot, '.sites-runtime/rehearsal');
mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'launcher.log');
const url = 'http://127.0.0.1:5174/?caseId=campus';
function log(message) {
  console.log(message);
  appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
}
function pipe(stream, output) {
  stream.on('data', chunk => { output.write(chunk); appendFileSync(logFile, chunk); });
}
async function openBrowser() {
  // Wait for the shell to finish dispatching the URL before exiting a reused launcher.
  const result = await new Promise(resolve => {
    const child = spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' });
    const timeout = setTimeout(() => { child.kill(); resolve('browser dispatch timed out'); }, 8000);
    child.once('exit', () => clearTimeout(timeout));
    child.once('error', () => clearTimeout(timeout));
    child.once('error', error => resolve(error.message));
    child.once('exit', code => resolve(code === 0 ? null : `exit ${code}`));
  });
  if (result) log(`浏览器自动打开失败 (${result})，请手动打开：${url}`);
  else log(`已向默认浏览器发送打开请求：${url}`);
}
async function running() {
  try {
    const response = await fetch('http://127.0.0.1:5174/api/rehearsal?caseId=campus', { signal: AbortSignal.timeout(1500) });
    try { const data = await response.json(); return data.enabled === true ? 'demo' : 'other'; }
    catch { return 'other'; }
  } catch { return false; }
}
let child;
try {
  log(`启动演示；Node ${process.version}；程序目录 ${projectRoot}`);
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13)) throw Error('请安装 Node.js 24，当前 Node 版本过低。');
  const existing = await running();
  if (existing === 'demo') {
    log('彩排已在运行。新一轮请使用页面中的“开始新一轮彩排”。');
    await openBrowser();
  } else {
    if (existing === 'other') throw Error('5174 端口由其他服务占用，请先关闭该服务后重试。');
    if (!existsSync(path.join(projectRoot, 'dist/server/wrangler.json'))) throw Error('请先在 heyi-os 目录执行 npm.cmd ci 和 npm.cmd run setup。');
    const { startArgs, localConfig, wrangler, environmentFile } = await import('./local.mjs');
    const stateDirectory = path.join(logDir, 'state');
    mkdirSync(stateDirectory, { recursive: true });
    log('正在检查彩排数据库，请稍候…');
    const migrationCode = await new Promise((resolve, reject) => {
      const migration = spawn(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'DB', '--local', '--config', localConfig(), '--persist-to', stateDirectory, '--env-file', environmentFile({ withoutSecrets: true })], { cwd: projectRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: 'true' } });
      pipe(migration.stdout, process.stdout); pipe(migration.stderr, process.stderr);
      migration.once('error', reject); migration.once('exit', resolve);
    });
    if (migrationCode !== 0) throw Error('彩排数据库初始化失败，请查看启动日志。');
    child = spawn(process.execPath, startArgs({ stateDirectory, port: 5174, withoutSecrets: true, rehearsal: true }), { cwd: projectRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ACCTOKEN_API_KEY: '' } });
    pipe(child.stdout, process.stdout); pipe(child.stderr, process.stderr);
    let failure;
    child.on('error', error => { failure = error; });
    const exited = new Promise(resolve => child.once('exit', resolve));
    const stop = () => child.kill('SIGTERM');
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    let ready = false;
    for (let i = 0; i < 90; i++) {
      if (failure) throw failure;
      if (child.exitCode !== null) throw Error('服务启动失败，请查看启动日志。');
      if (await running() === 'demo') { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw Error('启动超过等待时间，请查看启动日志。');
    log(`彩排已就绪：${url}\n请保留此窗口；Ctrl+C 停止。`);
    writeFileSync(path.join(logDir, 'last-start.json'), JSON.stringify({ url, startedAt: new Date().toISOString() }));
    await openBrowser();
    const code = await exited;
    process.off('SIGINT', stop); process.off('SIGTERM', stop);
    if (code) throw Error(`服务已退出，退出码 ${code}。`);
  }
} catch (error) {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  log(`启动失败：${error.stack || error.message}\n日志：${logFile}`);
  process.exitCode = 1;
}