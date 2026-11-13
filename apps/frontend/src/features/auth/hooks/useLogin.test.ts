import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import { useLogin } from './useLogin'

const session = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  notice: '',
}))
vi.mock('../../../app/sessionContext', () => ({ useSession: () => session }))
beforeEach(() => {
  vi.clearAllMocks()
})

it.each([
  ['ab', 'valid-long-passphrase', 'ログインID'],
  ['u'.repeat(21), 'valid-long-passphrase', 'ログインID'],
  ['bad id', 'valid-long-passphrase', 'ログインID'],
  ['operator', 'x'.repeat(14), '15〜32文字'],
  ['operator', 'x'.repeat(33), '15〜32文字'],
  ['operator', ' '.repeat(15), '空白のみ'],
])(
  'rejects invalid registration before calling the API (%#)',
  async (userId, password, message) => {
    const { result } = renderHook(() => useLogin())
    act(() => {
      result.current.selectMode(true)
      result.current.setUserId(userId)
      result.current.setPassword(password)
      result.current.setConfirmation(password)
    })
    await act(() => result.current.login())
    expect(result.current.error).toContain(message)
    expect(session.signUp).not.toHaveBeenCalled()
    expect(session.signIn).not.toHaveBeenCalled()
  },
)

it('accepts the registration boundaries without trimming the password', async () => {
  const { result } = renderHook(() => useLogin())
  const password = ' 1234567890123 '
  act(() => {
    result.current.selectMode(true)
    result.current.setUserId('u'.repeat(20))
    result.current.setPassword(password)
    result.current.setConfirmation(password)
  })
  await act(() => result.current.login())
  expect(session.signUp).toHaveBeenCalledExactlyOnceWith(
    'u'.repeat(20),
    password,
  )
})

it.each(['old-pass', 'x'.repeat(64)])(
  'does not apply new registration rules when signing into an existing account (%#)',
  async (password) => {
    const { result } = renderHook(() => useLogin())
    act(() => {
      result.current.setUserId('legacy-'.repeat(8))
      result.current.setPassword(password)
    })
    await act(() => result.current.login())
    expect(session.signIn).toHaveBeenCalledExactlyOnceWith(
      'legacy-'.repeat(8),
      password,
    )
  },
)
