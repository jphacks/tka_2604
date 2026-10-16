import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

import { getPlatformProxy } from 'wrangler'

export async function applyMigrations(
  binding: D1Database,
  options: { after?: string; through?: string } = {},
) {
  const directory = new URL('../../db/migrations/', import.meta.url)
  const files = (await readdir(fileURLToPath(directory)))
    .filter(
      (name) =>
        name.endsWith('.sql') &&
        (!options.after || name > options.after) &&
        (!options.through || name <= options.through),
    )
    .sort()
  for (const file of files) {
    const migration = await readFile(
      fileURLToPath(new URL(file, directory)),
      'utf8',
    )
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await binding.prepare(statement).run()
    }
  }
}

export async function testDatabase(options: { through?: string } = {}) {
  const runtime = await getPlatformProxy<CloudflareBindings>({
    configPath: fileURLToPath(new URL('../wrangler.jsonc', import.meta.url)),
    persist: false,
    remoteBindings: false,
    envFiles: [],
  })
  try {
    const binding = runtime.env.DB
    await applyMigrations(binding, options)
    return { binding, dispose: () => runtime.dispose() }
  } catch (error) {
    await runtime.dispose()
    throw error
  }
}
