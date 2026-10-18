import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

// Only the isolated E2E database gets these disposable credentials. The normal
// seed deliberately has no usable password, and no test password is committed.
export default async function authSetup() {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  const password = randomBytes(32).toString('base64url')
  const state = process.env.SOLVER_E2E_STATE ?? '.wrangler/e2e-api'
  process.env.SETLY_E2E_PASSWORD = password
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--experimental-strip-types',
        'scripts/provision-user.mjs',
        '--local',
        '--env',
        'develop',
        '--persist-to',
        state,
        '--user-id',
        'demo-owner',
      ],
      { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] },
    )
    child.once('error', () =>
      reject(new Error('Could not start E2E user provisioning.')),
    )
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              'E2E user provisioning failed. Apply the authentication migration to the isolated test database.',
            ),
          ),
    )
    child.stdin.end(`${password}\n`)
  })
}
