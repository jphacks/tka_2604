import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./features/event/hooks/useChatScroll', () => ({
  useChatScroll: () => null,
}))

import App from './App'
import { eventRepository } from './features/event/repositories/eventRepository'
import { registrationRepository } from './features/forms/repositories/registrationRepository'
import { workspaceRepository } from './shared/repositories/workspaceRepository'

beforeEach(async () => {
  await workspaceRepository.signOut()
  vi.spyOn(workspaceRepository, 'listEvents').mockResolvedValue([])
  let createdName = ''
  vi.spyOn(workspaceRepository, 'createEvent').mockImplementation((draft) => {
    createdName = draft.name
    return Promise.resolve({
      ...draft,
      id: 'created-event',
    })
  })
  vi.spyOn(eventRepository, 'getEvent').mockImplementation((id) =>
    Promise.resolve({
      id,
      name: createdName,
      members: [],
      performances: [],
      sections: [{ id: 'part-1', slots: [null, null, null, null] }],
      constraints: [],
      unassigned: [],
      messages: [],
      scheduleMode: 'dense',
    }),
  )
  window.history.replaceState(null, '', '/')
})

describe('application navigation', () => {
  it('opens the workspace and signs out', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(
      await screen.findByRole('button', { name: 'ワークスペースを開く' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'マイイベント' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'ログアウト' }))
    expect(
      await screen.findByRole('button', { name: 'ワークスペースを開く' }),
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
    await workspaceRepository.signIn('operator@example.com')
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
    await workspaceRepository.signIn('operator@example.com')
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
    await workspaceRepository.signIn('operator@example.com')
    vi.spyOn(eventRepository, 'getEvent').mockRejectedValue(
      new Error('イベントが見つかりません。'),
    )
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
    await user.click(
      screen.getAllByRole('button', { name: 'イベントを作成' })[0],
    )
    expect(
      await screen.findByRole('dialog', { name: '新しいイベントを作成' }),
    ).toBeVisible()
  })
})

describe('event toolbar dialogs', () => {
  it('keeps the workspace open while editing basic information and managing the form', async () => {
    await workspaceRepository.signIn('operator@example.com')
    window.history.replaceState(null, '', '/event/toolbar-event')
    let details = {
      id: 'toolbar-event',
      name: 'ライブ名',
      date: '',
      venue: '',
      description: '',
    }
    vi.spyOn(workspaceRepository, 'getDetails').mockImplementation(() =>
      Promise.resolve(details),
    )
    const save = vi
      .spyOn(workspaceRepository, 'updateDetails')
      .mockImplementation((_id, input) => {
        details = { ...details, ...input }
        return Promise.resolve(details)
      })
    const getEvent = vi
      .spyOn(eventRepository, 'getEvent')
      .mockImplementation((id) =>
        Promise.resolve({
          id,
          name: details.name,
          members: [],
          performances: [],
          sections: [{ id: 'part-1', slots: [null, null, null, null] }],
          constraints: [],
          unassigned: [],
          messages: [],
          scheduleMode: 'dense',
        }),
      )
    vi.spyOn(registrationRepository, 'get').mockResolvedValue({
      eventId: details.id,
      eventTitle: details.name,
      updatedAt: 'revision',
      bands: [],
      members: [],
      memberships: [],
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'ライブ名' })
    expect(screen.getByRole('button', { name: 'CSVから追加' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'CSVを出力' })).toBeVisible()
    expect(screen.queryByRole('link', { name: '設定' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'フォーム管理' }))
    const forms = await screen.findByRole('dialog', { name: 'フォーム管理' })
    expect(
      await within(forms).findByRole('textbox', {
        name: '回答フォームのリンク',
      }),
    ).toHaveValue(`${window.location.origin}/event/toolbar-event/forms`)
    await user.click(within(forms).getByRole('button', { name: '閉じる' }))
    await user.click(screen.getByRole('button', { name: 'ライブ情報の編集' }))
    const edit = await screen.findByRole('dialog', { name: 'ライブ情報の編集' })
    const name = await within(edit).findByRole('textbox', {
      name: 'イベント名',
    })
    await user.clear(name)
    await user.type(name, '変更したライブ名')
    await user.click(within(edit).getByRole('button', { name: '変更を保存' }))
    await within(edit).findByText('イベントの設定を更新しました。')
    expect(save).toHaveBeenCalledOnce()
    expect(getEvent).toHaveBeenCalledTimes(2)
    await user.click(within(edit).getByRole('button', { name: '閉じる' }))
    expect(
      await screen.findByRole('heading', {
        name: '変更したライブ名',
      }),
    ).toBeVisible()
    expect(window.location.pathname).toBe('/event/toolbar-event')
  })
})

it('shows chat failures above the input and resends from the normal send button', async () => {
  await workspaceRepository.signIn('operator@example.com')
  window.history.replaceState(null, '', '/event/chat-error-event')
  const send = vi
    .spyOn(eventRepository, 'sendMessage')
    .mockRejectedValueOnce(new Error('通信に失敗しました。'))
    .mockRejectedValueOnce(new Error('再度の通信失敗'))
    .mockResolvedValueOnce({ reply: '返信です。' })
  const getMessages = vi
    .spyOn(eventRepository, 'getMessages')
    .mockResolvedValue([])
  const user = userEvent.setup()
  render(<App />)
  const input = await screen.findByRole('textbox', { name: 'AIへのメッセージ' })
  await user.type(input, '出演間隔を空けたい')
  await user.click(screen.getByRole('button', { name: 'メッセージを送信' }))
  const error = await screen.findByRole('alert')
  expect(error).toHaveTextContent('メッセージの送信に失敗しました')
  expect(error).toHaveTextContent('送信ボタンからもう一度送信してください。')
  expect(error).not.toHaveTextContent('通信に失敗しました。')
  expect(input.closest('form')).toContainElement(error)
  expect(input).toHaveValue('出演間隔を空けたい')
  expect(
    screen.queryByRole('button', { name: /再試行/ }),
  ).not.toBeInTheDocument()
  await user.click(
    within(error).getByRole('button', { name: 'エラーを閉じる' }),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(input).toHaveValue('出演間隔を空けたい')
  await user.click(screen.getByRole('button', { name: 'メッセージを送信' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'メッセージの送信に失敗しました',
  )
  const id = send.mock.calls[0][3]!
  getMessages.mockResolvedValue([
    { id, role: 'user', text: '出演間隔を空けたい' },
    {
      id: 'reply',
      role: 'assistant',
      text: '返信です。',
      replyToMessageId: id,
    },
  ])
  await user.click(screen.getByRole('button', { name: 'メッセージを送信' }))
  expect(await screen.findByText('返信です。')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(send.mock.calls[1][3]).toBe(id)
  expect(send.mock.calls[2][3]).toBe(id)
})
