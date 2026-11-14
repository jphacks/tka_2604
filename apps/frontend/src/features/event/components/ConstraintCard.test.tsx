import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import type { ConstraintStatus } from '../../../shared/model/constraints'
import { eventFixture } from '../../../test/fixtures/event'
import { ConstraintCard } from './ConstraintCard'

it.each<ConstraintStatus>(['met', 'unchecked', 'disabled', 'unmet', 'invalid'])(
  'shows status details only for violations or invalid conditions: %s',
  (status) => {
    const detail = {
      met: '達成',
      unchecked: '対象に未配置の出演枠があります',
      disabled: '無効',
      unmet: '必須条件に違反しています',
      invalid: '対象が存在しません',
    }[status]
    render(
      <ConstraintCard
        view={{
          constraint: {
            ...eventFixture.constraints[0],
            enabled: status !== 'disabled',
          },
          text: '条件の要約',
          status,
          detail,
        }}
        onUpdate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: '条件の要約' })).toBeVisible()
    if (status === 'unmet' || status === 'invalid')
      expect(screen.getByText(detail)).toBeVisible()
    else expect(screen.queryByText(detail)).toBeNull()
  },
)
