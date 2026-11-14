import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { ChatMessageItem } from './ChatMessageItem'

it.each(['提案を受理しました。', '提案を破棄しました。'])(
  'shows %s as a system notice without a speaker or retry button',
  (text) => {
    render(
      <ChatMessageItem
        message={{
          id: 'decision-123e4567-e89b-42d3-a456-426614174000',
          role: 'user',
          text,
        }}
      />,
    )
    expect(
      screen.getByRole('note', { name: 'システムメッセージ' }),
    ).toHaveTextContent(text)
    expect(screen.queryByText('あなた')).not.toBeInTheDocument()
    expect(screen.queryByText('AIアシスタント')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  },
)

it('shows ordinary user messages without a speaker label or retry button', () => {
  render(
    <ChatMessageItem
      message={{
        id: 'ordinary-message',
        role: 'user',
        text: '提案を受理しました。',
      }}
    />,
  )
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
  expect(screen.queryByText('あなた')).not.toBeInTheDocument()
  expect(screen.getByText('提案を受理しました。')).toBeVisible()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('keeps the AI speaker label', () => {
  render(
    <ChatMessageItem
      message={{
        id: 'assistant-message',
        role: 'assistant',
        text: '出演順を提案します。',
      }}
    />,
  )
  expect(screen.getByText('AIアシスタント')).toBeVisible()
  expect(screen.getByText('出演順を提案します。')).toBeVisible()
})
