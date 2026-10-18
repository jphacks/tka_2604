import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = await mkdtemp(join(tmpdir(), 'setly-solver-e2e-'))
const token = randomUUID()
const envFile = join(directory, '.env')
const state = join(directory, 'state')

async function run(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  const status = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`${command} terminated: ${signal}`))
      else resolve(code)
    })
  })
  if (status !== 0) throw new Error(`${command} failed (${status})`)
}

try {
  await writeFile(
    envFile,
    `SOLVER_API_URL=http://localhost:8001\nSOLVER_API_TOKEN=${token}\n`,
    { mode: 0o600 },
  )
  const wrangler = ['node_modules/wrangler/bin/wrangler.js']
  const database = ['--env', 'develop', '--local', '--persist-to', state]
  await run(process.execPath, [
    ...wrangler,
    'd1',
    'migrations',
    'apply',
    'DB',
    ...database,
  ])
  await run(process.execPath, [
    ...wrangler,
    'd1',
    'execute',
    'DB',
    ...database,
    '--file',
    'apps/backend/db/seed.sql',
  ])
  await run(
    'npm',
    [
      'run',
      'test:e2e:solver',
      '--workspace=@jphack-2026/frontend',
      '--',
      ...process.argv.slice(2),
    ],
    {
      SOLVER_E2E_ENV_FILE: envFile,
      SOLVER_E2E_STATE: state,
      SOLVER_E2E_TOKEN: token,
    },
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Solver E2E failed')
  process.exitCode = 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
