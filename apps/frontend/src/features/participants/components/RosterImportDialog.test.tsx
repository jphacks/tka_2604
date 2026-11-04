import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { eventFixture } from '../../../test/fixtures/event'

const upload = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useRosterImport', () => ({ importRoster: upload }))
import { RosterImportDialog } from './RosterImportDialog'

it('shows invalid input and submits the selected additions only once while pending', async () => {
  const completed = vi.fn()
  const pending = new Promise<void>(() => {})
  upload.mockReturnValue(pending)
  render(
    <RosterImportDialog
      event={{ ...eventFixture, updatedAt: 'revision' }}
      onBusy={vi.fn()}
      onClose={vi.fn()}
      onImported={completed}
    />,
  )
  const input = screen.getByLabelText('追加する名簿CSV')
  function select(text: string) {
    const file = new File([], 'roster.csv')
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new TextEncoder().encode(text).buffer),
    })
    fireEvent.change(input, { target: { files: [file] } })
  }
  select('incorrect')
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('見出し'),
  )
  select('曲名,メンバー1\n追加バンド,新規の人')
  await screen.findByText(/1組・1人を追加/)
  fireEvent.click(screen.getByText('追加する'))
  fireEvent.click(screen.getByText('追加する'))
  expect(upload).toHaveBeenCalledTimes(1)
  expect(upload.mock.calls[0][3]).toBe('revision')
  expect(completed).not.toHaveBeenCalled()
})
