import { DndContext } from '@dnd-kit/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'

import { PerformanceRow } from './PerformanceRow'

it('disables dragging and order edits until a fixed band is unlocked', async () => {
  const user = userEvent.setup()
  const onOrder = vi.fn()
  function Example() {
    const [fixed, setFixed] = useState(true)
    return (
      <DndContext>
        <PerformanceRow
          row={{
            key: 'a',
            order: 1,
            target: { sectionId: 's', index: 0 },
            performance: {
              id: 'a',
              name: '出演枠A',
              memberIds: [],
              members: [],
              fixed,
            },
          }}
          capacity={3}
          onFixed={(_, next) => setFixed(next)}
          onOrder={onOrder}
          onDetails={vi.fn()}
        />
      </DndContext>
    )
  }
  render(<Example />)
  expect(
    screen.getByRole('button', { name: '出演枠Aを並べ替え' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('textbox', { name: '出演枠Aの出演順' }),
  ).toBeDisabled()
  await user.click(screen.getByRole('checkbox', { name: '出演枠Aを固定' }))
  expect(
    screen.getByRole('button', { name: '出演枠Aを並べ替え' }),
  ).toBeEnabled()
  const order = screen.getByRole('textbox', { name: '出演枠Aの出演順' })
  expect(order).toBeEnabled()
  await user.clear(order)
  await user.type(order, '2{Enter}')
  expect(onOrder).toHaveBeenCalledWith('a', 2)
})
