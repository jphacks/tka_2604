import type * as Crypto from 'node:crypto'
import { scrypt, timingSafeEqual } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import {
  hashPassword,
  verifyPassword,
} from '../../../src/services/auth/password'

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof Crypto>()
  return {
    ...actual,
    scrypt: vi.fn(actual.scrypt),
    timingSafeEqual: vi.fn(actual.timingSafeEqual),
  }
})

const knownHash =
  'scrypt$1$16384$8$5$00112233445566778899aabbccddeeff$ad095914abea190d8ea245fc29abe6816e421bfc1dff5e7650275ceb5ad786de'

describe('password hashing', () => {
  it('verifies a known scrypt vector and rejects a different password', async () => {
    await expect(
      verifyPassword('known-test-password', knownHash),
    ).resolves.toBe(true)
    await expect(verifyPassword('incorrect-password', knownHash)).resolves.toBe(
      false,
    )
    expect(timingSafeEqual).toHaveBeenCalledTimes(2)
  })

  it('uses a distinct random salt and preserves Unicode, whitespace and null bytes', async () => {
    const password = '  ライブ🎸\u0000 test-only  '
    const first = await hashPassword(password)
    const second = await hashPassword(password)

    expect(first).toMatch(
      /^scrypt\$1\$16384\$8\$5\$[a-f0-9]{32}\$[a-f0-9]{64}$/,
    )
    expect(second).not.toBe(first)
    expect(first).not.toContain(password)
    await expect(verifyPassword(password, first)).resolves.toBe(true)
    await expect(verifyPassword(password.trim(), first)).resolves.toBe(false)
  })

  it.each([
    undefined,
    null,
    '',
    'test-only',
    knownHash.replace('$1$', '$2$'),
    knownHash.replace('$16384$', '$1073741824$'),
    knownHash.replace('$8$', '$1$'),
    knownHash.replace('$5$', '$999999999$'),
    knownHash.replace('001122', 'gg1122'),
    knownHash.slice(0, -1),
    `${knownHash}$extra`,
    'x'.repeat(10_000),
  ])(
    'rejects a missing or corrupt hash with bounded dummy work (%#)',
    async (hash) => {
      await expect(verifyPassword('known-test-password', hash)).resolves.toBe(
        false,
      )
      expect(scrypt).toHaveBeenCalledOnce()
      expect(scrypt).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Uint8Array),
        32,
        { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 },
        expect.any(Function),
      )
      expect(timingSafeEqual).toHaveBeenCalledOnce()
    },
  )

  it('limits password input by UTF-8 byte length without silently truncating', async () => {
    const boundary = '🎸'.repeat(256)
    const hash = await hashPassword(boundary)
    await expect(verifyPassword(boundary, hash)).resolves.toBe(true)
    await expect(hashPassword(`${boundary}x`)).rejects.toThrow(RangeError)
    await expect(verifyPassword(`${boundary}x`, hash)).resolves.toBe(false)
    await expect(hashPassword('')).rejects.toThrow(RangeError)
    await expect(verifyPassword('', hash)).resolves.toBe(false)
  })
})
