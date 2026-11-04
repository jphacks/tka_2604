import { expect, it } from 'vitest'

import { canAutoApprove } from './autoApproval'
import type { ChatProposal } from './chatProposal'

it('never auto-approves deletions or missing strength/priority settings', () => {
  const proposal: ChatProposal = {
    expectedUpdatedAt: 'revision',
    messageId: 'message',
    sourceText: '',
    actions: [{ type: 'delete_constraint', constraintId: 'c' }],
  }
  expect(canAutoApprove(proposal)).toBe(false)
  proposal.actions = [
    {
      type: 'add_constraint',
      constraint: {
        type: 'in_range',
        targets: { band_ids: ['a'] },
        params: { kind: 'parts', part_ids: [0] },
        hardness: 'soft',
        priority: null,
      },
    },
  ]
  expect(canAutoApprove(proposal)).toBe(false)
  const added = proposal.actions[0]
  if (added.type !== 'delete_constraint') added.constraint.priority = 'high'
  expect(canAutoApprove(proposal)).toBe(true)
  proposal.actions.push({ type: 'delete_constraint', constraintId: 'c' })
  expect(canAutoApprove(proposal)).toBe(false)
})
