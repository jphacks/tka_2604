import type { ChatProposal } from './chatProposal'

export const autoApprovalKey = 'setly:auto-approve-constraints:v1'
export function readAutoApproval() {
  try {
    return localStorage.getItem(autoApprovalKey) === 'enabled'
  } catch {
    return false
  }
}
export function storeAutoApproval(value: boolean) {
  try {
    localStorage.setItem(autoApprovalKey, value ? 'enabled' : 'disabled')
  } catch {
    /* The current page can still use the setting. */
  }
}
export function canAutoApprove(proposal: ChatProposal) {
  return (
    proposal.actions.length > 0 &&
    proposal.actions.every(
      (action) =>
        action.type !== 'delete_constraint' &&
        (action.constraint.hardness === 'hard'
          ? action.constraint.priority === null
          : action.constraint.hardness === 'soft' &&
            action.constraint.priority !== null),
    )
  )
}
