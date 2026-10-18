import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { AutoComplete } from './AutoComplete'

function SongInput() {
  const [value, setValue] = useState('')
  const songs = ['春の歌', '夜の歌']
  return (
    <AutoComplete
      allowCustomValue
      label="曲名"
      value={value}
      options={songs
        .filter((song) => song.includes(value))
        .map((song) => ({ value: song, label: song }))}
      onValueChange={setValue}
      onSelect={setValue}
      placeholder="曲名を入力"
    />
  )
}

describe('AutoComplete', () => {
  it('supports song suggestions and free text without member-specific content', async () => {
    const user = userEvent.setup()
    render(<SongInput />)
    const input = screen.getByRole('combobox', { name: '曲名' })
    await user.type(input, '春')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByText('春の歌')).toBeVisible()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '曲名の選択を解除' }))
    const newInput = screen.getByRole('combobox', { name: '曲名' })
    await user.type(newInput, '新しい曲')
    expect(screen.getByText('一致する候補がありません。')).toBeVisible()
    await user.keyboard('{Escape}')
    expect(newInput).toHaveValue('新しい曲')
    await user.keyboard('{Enter}')
    expect(screen.getByText('新しい曲')).toBeVisible()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

function ExistingSongInput() {
  const [value, setValue] = useState('')
  return (
    <>
      <AutoComplete
        label="既存の曲名"
        value={value}
        options={[{ value: 'song-1', label: '春の歌' }]}
        onValueChange={setValue}
        onSelect={setValue}
      />
      <output aria-label="選択ID">{value}</output>
    </>
  )
}

it('keeps search text out of the selected ID and rejects custom values by default', async () => {
  const user = userEvent.setup()
  render(<ExistingSongInput />)
  const input = screen.getByRole('combobox', { name: '既存の曲名' })
  await user.type(input, '未登録の曲{Enter}')
  expect(input).toHaveValue('未登録の曲')
  expect(screen.getByLabelText('選択ID')).toBeEmptyDOMElement()
  expect(
    screen.queryByRole('button', { name: '既存の曲名の選択を解除' }),
  ).not.toBeInTheDocument()
  await user.clear(input)
  await user.type(input, '春{ArrowDown}{Enter}')
  expect(screen.getByLabelText('選択ID')).toHaveTextContent('song-1')
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: '既存の曲名の選択を解除' }),
  )
  expect(screen.getByLabelText('選択ID')).toBeEmptyDOMElement()
  expect(screen.getByRole('combobox')).toHaveValue('')
})
