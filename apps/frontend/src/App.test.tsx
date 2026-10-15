import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import App from './App'
import { mockWorkspaceStore } from './mock/workspaceStore'

beforeEach(() => {
  mockWorkspaceStore.signOut()
  window.history.replaceState(null, '', '/')
})

describe('application navigation', () => {
  it('opens the demo without asking for real credentials', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(
      await screen.findByRole('button', { name: 'デモアカウントで試す' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'マイイベント' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'ログアウト' }))
    expect(
      await screen.findByRole('button', { name: 'デモアカウントで試す' }),
    ).toBeVisible()
  })
  it('shows recovery links for unknown URLs', () => {
    window.history.replaceState(null, '', '/missing')
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'ページが見つかりません' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'イベント一覧へ' }),
    ).toHaveAttribute('href', '/event')
  })
})
