import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { mockWorkspaceStore } from './mock/workspaceStore'
import { workspaceRepository } from './shared/repositories/workspaceRepository'

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

describe('event creation entry points', () => {
  it('opens creation from the empty list and creates an event', async () => {
    vi.spyOn(workspaceRepository, 'listEvents').mockResolvedValue([])
    mockWorkspaceStore.signIn('demo@example.com')
    window.history.replaceState(null, '', '/event')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('最初のイベントを作成しましょう')
    const buttons = screen.getAllByRole('button', {
      name: 'イベントを作成',
    })
    expect(buttons).toHaveLength(2)
    await user.click(buttons[1])
    expect(
      await screen.findByRole('dialog', { name: '新しいイベントを作成' }),
    ).toBeVisible()
    await user.type(
      screen.getByRole('textbox', { name: /イベント名/ }),
      '空の一覧から作成',
    )
    await user.click(
      screen.getAllByRole('button', { name: 'イベントを作成' }).at(-1)!,
    )
    expect(
      await screen.findByRole('heading', { name: '空の一覧から作成' }),
    ).toBeVisible()
  })
  it('keeps creation input after a save failure and allows a retry', async () => {
    const create = vi
      .spyOn(workspaceRepository, 'createEvent')
      .mockRejectedValueOnce(new Error('DBへの保存に失敗しました。'))
    mockWorkspaceStore.signIn('demo@example.com')
    window.history.replaceState(null, '', '/event?create=1')
    const user = userEvent.setup()
    render(<App />)
    const name = await screen.findByRole('textbox', { name: /イベント名/ })
    await user.type(name, '保存を再試行するイベント')
    await user.click(
      screen.getAllByRole('button', { name: 'イベントを作成' }).at(-1)!,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'DBへの保存に失敗しました。',
    )
    expect(name).toHaveValue('保存を再試行するイベント')
    expect(window.location.pathname).toBe('/event')
    await user.click(
      screen.getAllByRole('button', { name: 'イベントを作成' }).at(-1)!,
    )
    expect(
      await screen.findByRole('heading', { name: '保存を再試行するイベント' }),
    ).toBeVisible()
    expect(create).toHaveBeenCalledTimes(2)
  })
  it('opens the creation form from an unavailable event and can return to the list', async () => {
    mockWorkspaceStore.signIn('demo@example.com')
    window.history.replaceState(null, '', '/event/missing-event')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('イベントが見つかりません。')
    await user.click(screen.getByRole('link', { name: 'イベントを作成' }))
    expect(
      await screen.findByRole('heading', { name: 'マイイベント' }),
    ).toBeVisible()
    expect(
      await screen.findByRole('dialog', { name: '新しいイベントを作成' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
    await user.click(screen.getByRole('button', { name: 'イベントを作成' }))
    expect(
      await screen.findByRole('dialog', { name: '新しいイベントを作成' }),
    ).toBeVisible()
  })
})
