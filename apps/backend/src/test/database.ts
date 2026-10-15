import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

import { getPlatformProxy } from 'wrangler'

export async function testDatabase() {
  const runtime = await getPlatformProxy<CloudflareBindings>({
    configPath: fileURLToPath(
      new URL('../../test/wrangler.jsonc', import.meta.url),
    ),
    persist: false,
    remoteBindings: false,
    envFiles: [],
  })
  try {
    const binding = runtime.env.DB
    const directory = new URL('../../db/migrations/', import.meta.url)
    const files = (await readdir(fileURLToPath(directory)))
      .filter((name) => name.endsWith('.sql'))
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
    return { binding, dispose: () => runtime.dispose() }
  } catch (error) {
    await runtime.dispose()
    throw error
  }
}
