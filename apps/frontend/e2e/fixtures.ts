import { expect, test as base } from '@playwright/test'

export { expect } from '@playwright/test'

export const test = base.extend<{ runtimeErrors: void }>({
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
