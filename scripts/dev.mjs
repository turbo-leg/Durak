import { spawn } from 'node:child_process';

// npm's shell '&' starts processes sequentially on Windows. Launch both
// workspaces directly and stop only the process trees created here.
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script using npm run dev');
const children = ['dev:server', 'dev:client'].map((script) =>
  spawn(process.execPath, [npmCli, 'run', script], {
    stdio: 'inherit',
    windowsHide: true,
    detached: process.platform !== 'win32',
  }),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        /* Already exited. */
      }
    }
  }
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
children.forEach((child) => {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
});
