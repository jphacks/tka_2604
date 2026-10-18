import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { hashPassword } from '../apps/backend/src/services/auth/password.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const usage = `Usage: npm run auth:provision -- --local --user-id USER [--env develop] [--persist-to PATH]
       npm run auth:provision -- --remote --env develop|main --user-id USER

Creates a user or changes the password without changing their events.
All existing sessions for that user are revoked. Apply DB migrations first.
Passwords are read with hidden terminal input and confirmation, or from stdin.
Passwords must be 15–128 characters. Never pass a password as an argument.
Only --local --user-id demo-owner may add --local-demo-password to allow 8–128 characters.
`

function options() {
  let values
  try {
    ;({ values } = parseArgs({
      options: {
        local: { type: 'boolean' },
        remote: { type: 'boolean' },
        env: { type: 'string' },
        'user-id': { type: 'string' },
        'persist-to': { type: 'string' },
        'local-demo-password': { type: 'boolean' },
        help: { type: 'boolean' },
      },
      allowPositionals: false,
    }))
  } catch {
    // Parser errors can echo unknown arguments, including an accidental password.
    throw new Error(
      'Invalid arguments. Use --help; do not pass passwords as arguments.',
    )
  }
  if (values.help) return null
  if (Boolean(values.local) === Boolean(values.remote))
    throw new Error('Choose exactly one explicit target: --local or --remote.')
  if (values.remote && !values.env)
    throw new Error(
      '--remote requires an explicit --env develop or --env main.',
    )
  const env = values.env ?? 'develop'
  if (!['develop', 'main'].includes(env))
    throw new Error('Invalid environment.')
  const userId = values['user-id']
  if (!userId || !/^[A-Za-z0-9_-]{3,64}$/.test(userId))
    throw new Error(
      'User ID must be 3–64 ASCII letters, digits, underscores or hyphens.',
    )
  if (values.remote && values['persist-to'])
    throw new Error('--persist-to can only be used with --local.')
  const localDemoPassword = Boolean(values['local-demo-password'])
  if (localDemoPassword && (!values.local || userId !== 'demo-owner'))
    throw new Error(
      '--local-demo-password is only allowed with --local --user-id demo-owner.',
    )
  return {
    local: Boolean(values.local),
    env,
    userId,
    persistTo: values['persist-to'],
    localDemoPassword,
  }
}

async function hiddenInput(prompt) {
  const silentOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })
  const reader = createInterface({
    input: process.stdin,
    output: silentOutput,
    terminal: true,
  })
  process.stderr.write(prompt)
  try {
    return await new Promise((resolve, reject) => {
      reader.once('SIGINT', () => reject(new Error('Provisioning cancelled.')))
      reader.question('', resolve)
    })
  } finally {
    reader.close()
    silentOutput.end()
    process.stderr.write('\n')
  }
}

async function readPassword() {
  if (process.stdin.isTTY) {
    const password = await hiddenInput('Password (hidden): ')
    if (password !== (await hiddenInput('Confirm password (hidden): ')))
      throw new Error('Passwords do not match.')
    return password
  }
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk.toString()
    if (input.length > 1024) throw new Error('Password input is too long.')
  }
  const password = input.replace(/\r?\n$/, '')
  if (/[\r\n]/.test(password))
    throw new Error('Provide exactly one password line on stdin.')
  return password
}

async function provision(target, password) {
  const minimumLength = target.localDemoPassword ? 8 : 15
  if (password.length < minimumLength || password.length > 128)
    throw new Error(`Password must contain ${minimumLength}–128 characters.`)
  const hash = await hashPassword(password)
  const directory = await mkdtemp(join(tmpdir(), 'setly-provision-'))
  try {
    const sqlFile = join(directory, 'provision.sql')
    // Both values are restricted to alphabets without SQL quoting characters.
    // Wrangler executes local multi-statement files with D1 batch semantics.
    await writeFile(
      sqlFile,
      `DELETE FROM auth_sessions WHERE user_id = '${target.userId}';
INSERT INTO users (user_id, password_hash) VALUES ('${target.userId}', '${hash}')
ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash;
`,
      { mode: 0o600 },
    )
    const args = [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      target.local ? '--local' : '--remote',
      '--env',
      target.env,
      '--file',
      sqlFile,
      '--yes',
      ...(target.persistTo ? ['--persist-to', target.persistTo] : []),
    ]
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: root,
        // Wrangler errors may include query text. Keep all output private and
        // remove its logs together with the protected SQL file after execution.
        stdio: 'ignore',
        env: {
          ...process.env,
          WRANGLER_LOG: 'none',
          WRANGLER_LOG_PATH: join(directory, 'wrangler.log'),
          WRANGLER_SEND_METRICS: 'false',
        },
      })
      child.once('error', () => reject(new Error('Could not start Wrangler.')))
      child.once('exit', (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(
                'D1 provisioning failed. Check the target, migrations and Cloudflare permissions; credentials were not printed.',
              ),
            ),
      )
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

try {
  const target = options()
  if (!target) process.stdout.write(usage)
  else {
    process.stderr.write(
      `Target: ${target.local ? 'local' : 'REMOTE'} D1 (${target.env}); user: ${target.userId}\n`,
    )
    await provision(target, await readPassword())
    process.stdout.write(
      'User credentials saved; existing sessions revoked. Event ownership and data were retained.\n',
    )
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Provisioning failed.')
  process.exitCode = 1
}
