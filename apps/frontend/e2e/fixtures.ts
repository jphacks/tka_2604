import type { APIRequestContext } from '@playwright/test'
import { expect, test as base } from '@playwright/test'

export { expect } from '@playwright/test'

type StorageState = Awaited<ReturnType<APIRequestContext['storageState']>>

export const test = base.extend<
  { runtimeErrors: void },
  { authenticatedState: StorageState }
>({
  authenticatedState: [
    async ({ playwright }, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL
      const password = process.env.SETLY_E2E_PASSWORD
      if (!baseURL || !password)
        throw new Error('E2E authentication setup is missing.')
      const request = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { Origin: new URL(baseURL).origin },
      })
      try {
        const response = await request.post('/api/auth/login', {
          data: { userId: 'demo-owner', password },
        })
        expect(response.status(), 'E2E login must succeed').toBe(200)
        await use(await request.storageState())
      } finally {
        await request.dispose()
      }
    },
    { scope: 'worker' },
  ],
  storageState: async ({ authenticatedState }, use) => use(authenticatedState),
  request: async ({ playwright, baseURL, authenticatedState }, use) => {
    if (!baseURL) throw new Error('E2E baseURL is missing.')
    const request = await playwright.request.newContext({
      baseURL,
      storageState: authenticatedState,
      extraHTTPHeaders: { Origin: new URL(baseURL).origin },
    })
    try {
      await use(request)
    } finally {
      await request.dispose()
    }
  },
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await use()
      expect(errors).toEqual([])
    },
    { auto: true },
  ],
})
