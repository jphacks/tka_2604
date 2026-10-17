import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'codegen-check-'))

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.signal ?? result.status})`)
  }
}

try {
  const generatedTs = join(temporaryDirectory, 'constraint.ts')
  const generatedPy = join(temporaryDirectory, 'constraint.py')
  const generatedValidator = join(
    temporaryDirectory,
    'constraint-validator.cjs',
  )

  run(process.execPath, [
    'node_modules/json-schema-to-typescript/dist/src/cli.js',
    '-i',
    'apps/schema/constraint.schema.json',
    '-o',
    generatedTs,
    '--cwd',
    'apps/schema',
  ])
  run('uv', [
    '--directory',
    'apps/solver',
    'run',
    '--locked',
    'datamodel-codegen',
    '--output',
    generatedPy,
  ])
  run(process.execPath, [
    'scripts/codegen-backend-constraint.mjs',
    generatedValidator,
  ])

  let matches = true
  for (const [current, generated] of [
    ['apps/frontend/src/generated/constraint.ts', generatedTs],
    ['apps/backend/src/generated/constraint.ts', generatedTs],
    ['apps/backend/src/generated/constraint-validator.cjs', generatedValidator],
    [
      'apps/backend/src/generated/constraint-validator.d.cts',
      generatedValidator.replace(/\.cjs$/, '.d.cts'),
    ],
    ['apps/solver/src/generated/constraint.py', generatedPy],
  ]) {
    const expected = await readFile(generated)
    const actual = await readFile(join(root, current)).catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (actual?.equals(expected)) continue

    matches = false
    console.error(`Generated code is out of date: ${current}`)
    if (actual === null) {
      console.error('The generated file is missing.')
    } else {
      const diff = spawnSync(
        'git',
        ['diff', '--no-index', '--exit-code', '--', current, generated],
        { cwd: root, stdio: 'inherit' },
      )
      if (diff.error) throw diff.error
      if (diff.status !== 0 && diff.status !== 1) {
        throw new Error(`git diff failed (${diff.signal ?? diff.status})`)
      }
    }
  }

  if (matches) {
    console.log('Generated code matches the current files.')
  } else {
    console.error('Run npm run codegen and include the updated files.')
    process.exitCode = 1
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
