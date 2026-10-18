import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { FormRoster } from '../repositories/types'
import { MemberNameInput } from './MemberNameInput'

const roster: FormRoster = {
  eventId: 'event',
  eventTitle: 'ライブ',
  updatedAt: '2026-10-19T00:00:00.000Z',
  bands: [
    {
      bandId: 'band',
      bandName: 'バンドA',
      description: null,
      requestText: null,
    },
  ],
  members: Array.from({ length: 7 }, (_, index) => ({
    memberId: `m${index + 1}`,
    memberName: index < 6 ? `田中 ${index + 1}` : '佐藤',
  })),
  memberships: [{ bandId: 'band', memberId: 'm1' }],
}

function Harness({
  onSelect = vi.fn(),
  disabled = false,
  excludedIds = [],
  initialValue = '',
}: {
  onSelect?: (memberId: string, fromKeyboard?: boolean) => void
  disabled?: boolean
  excludedIds?: string[]
  initialValue?: string
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <MemberNameInput
        roster={roster}
        value={value}
        label="メンバー1の名前"
        excludedIds={excludedIds}
        disabled={disabled}
        onValueChange={setValue}
        onSelect={(memberId, fromKeyboard) => {
          onSelect(memberId, fromKeyboard)
          setValue(memberId)
        }}
      />
      <button type="submit">送信</button>
      <button type="button">欄外</button>
    </form>
  )
}

describe('MemberNameInput', () => {
  it('shows matching labels without selecting until a suggestion is chosen', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    const input = screen.getByRole('combobox', { name: 'メンバー1の名前' })
    await user.type(input, '田中')
    expect(
      screen.getByRole('option', { name: /田中 1（バンドA/ }),
    ).toBeVisible()
    expect(onSelect).not.toHaveBeenCalled()
    await user.click(screen.getByRole('option', { name: /田中 1（バンドA/ }))
    expect(onSelect).toHaveBeenCalledWith('m1', false)
    expect(screen.getByText('田中 1（バンドA）')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'メンバー1の名前の選択を解除' }),
    ).toBeVisible()
  })

  it('renders an existing selection as a removable chip', async () => {
    const user = userEvent.setup()
    render(<Harness initialValue="m1" />)
    expect(screen.getByText('田中 1（バンドA）')).toBeVisible()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'メンバー1の名前の選択を解除' }),
    )
    const input = screen.getByRole('combobox', { name: 'メンバー1の名前' })
    expect(input).toHaveValue('')
    await waitFor(() => expect(input).toHaveFocus())
  })

  it('confirms a new member on Enter and clears the chip with its remove button', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    await user.type(screen.getByRole('combobox'), '新しい名前{Enter}')
    expect(screen.getByText('新しい名前')).toBeVisible()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'メンバー1の名前の選択を解除' }),
    )
    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  it('opens the full roster list when an empty input receives focus', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'メンバー1の名前' })
    await user.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('option')).toHaveLength(roster.members.length)
  })

  it('supports arrow and Enter selection without submitting the form', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const submit = vi.fn()
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <MemberNameInput
          roster={roster}
          value="田中"
          label="名前"
          excludedIds={[]}
          disabled={false}
          onValueChange={vi.fn()}
          onSelect={onSelect}
        />
      </form>,
    )
    const input = screen.getByRole('combobox', { name: '名前' })
    await user.click(input)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledWith('m1', true)
    expect(submit).not.toHaveBeenCalled()
  })

  it('keeps the new name through escape, tab and outside focus, and reports no matches', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    const input = screen.getByRole('combobox', { name: 'メンバー1の名前' })
    await user.type(input, '不存在')
    expect(screen.getByText(/一致する登録済みメンバーはいません/)).toBeVisible()
    await user.keyboard('{Escape}')
    expect(input).toHaveValue('不存在')
    await user.clear(input)
    await user.type(input, '田中')
    await user.keyboard('{Tab}')
    expect(onSelect).not.toHaveBeenCalled()
    expect(input).toHaveValue('田中')
    await user.click(screen.getByRole('button', { name: '欄外' }))
    expect(input).toHaveValue('田中')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows all matching results and responds to exclusions and disabled state', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'メンバー1の名前' })
    await user.type(input, '田中')
    expect(screen.getAllByRole('option')).toHaveLength(6)
    rerender(<Harness excludedIds={['m1']} />)
    await waitFor(() =>
      expect(
        screen.queryByRole('option', { name: /田中 1/ }),
      ).not.toBeInTheDocument(),
    )
    rerender(<Harness disabled />)
    expect(
      screen.getByRole('combobox', { name: 'メンバー1の名前' }),
    ).toBeDisabled()
  })

  it('does not select or submit on an IME composition Enter', () => {
    const onSelect = vi.fn()
    const submit = vi.fn()
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <MemberNameInput
          roster={roster}
          value="田中"
          label="名前"
          excludedIds={[]}
          disabled={false}
          onValueChange={vi.fn()}
          onSelect={onSelect}
        />
      </form>,
    )
    const input = screen.getByRole('combobox', { name: '名前' })
    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: true })
    expect(onSelect).not.toHaveBeenCalled()
    expect(submit).not.toHaveBeenCalled()
  })
})
