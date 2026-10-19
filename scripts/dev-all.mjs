// Starts the API and the app together, so one command is enough on your own computer.
// Press Ctrl+C once to stop both. Each line of output starts with [api] or [web].
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const parts = [
  { name: 'api', script: 'dev:api' },
  { name: 'web', script: 'dev:web' },
];

const children = parts.map(({ name, script }) => {
  const child = spawn('npm', ['run', script], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', (line) => console.log(`[${name}] ${line}`));
  }
  return child;
});

let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill('SIGINT'));
  setTimeout(() => process.exit(code), 500);
};
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
children.forEach((child, i) =>
  child.on('exit', (code) => {
    if (!stopping) {
      console.log(`[${parts[i].name}] stopped (exit code ${code ?? 'none'}), stopping the other one too`);
      stop(code ?? 1);
    }
  }),
);
