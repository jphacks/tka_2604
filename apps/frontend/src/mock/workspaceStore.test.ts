import { assert, test } from 'vitest'

import { parseMembers, validatePerformance } from '../shared/model/workspace'
import { createMockWorkspaceStore } from './workspaceStore'

const draft = {
  name: 'デモ出演枠',
  memberIds: [],
  members: '佐藤、田中\n佐藤',
  requests: '第2部以降を希望',
  contact: '',
}

test('mock login and logout do not require real credentials', () => {
  const store = createMockWorkspaceStore()
  assert.equal(store.getSession(), null)
  assert.equal(store.signIn('demo@example.com').email, 'demo@example.com')
  store.signOut()
  assert.equal(store.getSession(), null)
})

test('creating an event gives empty slots, a form, and its own detail', () => {
  const store = createMockWorkspaceStore()
  const event = store.createEvent({
    name: '新規イベント',
    date: '',
    venue: '',
    description: '',
  })
  const registration = store.getRegistration(event.id)
  assert.equal(registration.data.performances.length, 0)
  assert.equal(registration.data.sections.length, 3)
  assert.equal(registration.settings.accepting, true)
  assert.equal(store.listEvents().length, 4)
})

test('public submission appears in participants and the unassigned schedule', () => {
  const store = createMockWorkspaceStore()
  const id = store.submitPerformance('spring-live-2026', draft)
  const event = store.getEvent('spring-live-2026')
  assert.ok(event.unassigned.includes(id))
  assert.deepEqual(
    event.performances
      .find((item) => item.id === id)
      ?.memberIds.map(
        (id) => event.members.find((member) => member.id === id)?.name,
      ),
    ['佐藤', '田中'],
  )
  assert.equal(
    store.getRegistration(event.id).submissions.at(-1)?.requests,
    draft.requests,
  )
  assert.equal(store.listEvents()[0].responseCount, 4)
})

test('closed public form rejects responses but admins can add performances', () => {
  const store = createMockWorkspaceStore()
  const registration = store.getRegistration('spring-live-2026')
  store.updateForm(registration.event.id, {
    ...registration.settings,
    accepting: false,
  })
  assert.throws(
    () => store.submitPerformance(registration.event.id, draft),
    /受付は終了/,
  )
  const id = store.addPerformance(registration.event.id, draft)
  assert.ok(store.getEvent(registration.event.id).unassigned.includes(id))
  assert.equal(store.listEvents()[0].responseCount, 3)
})

test('disabled optional form fields are not saved', () => {
  const store = createMockWorkspaceStore()
  const registration = store.getRegistration('spring-live-2026')
  store.updateForm(registration.event.id, {
    ...registration.settings,
    collectRequests: false,
    collectContact: false,
  })
  store.submitPerformance(registration.event.id, {
    ...draft,
    contact: 'demo@example.com',
  })
  const response = store
    .getRegistration(registration.event.id)
    .submissions.at(-1)!
  assert.equal(response.contact, '')
  assert.equal(response.requests, '')
})

test('editing members and names updates the same performance, preserving order', () => {
  const store = createMockWorkspaceStore()
  store.updatePerformance('spring-live-2026', 'p1', {
    ...draft,
    name: '編集済み出演名',
  })
  const event = store.getEvent('spring-live-2026')
  assert.equal(event.sections[0].slots[0], 'p1')
  assert.equal(event.performances[0].name, '編集済み出演名')
  assert.ok(
    event.constraints.some(
      (constraint) =>
        constraint.type === 'at_position' &&
        constraint.targets.band_id === 'p1',
    ),
  )
})

test('deleting placed performances clears only their slot and response', () => {
  const store = createMockWorkspaceStore()
  store.deletePerformance('spring-live-2026', 'p2')
  const event = store.getEvent('spring-live-2026')
  assert.equal(event.sections[0].slots[1], null)
  assert.equal(event.performances.length, 13)
  assert.equal(store.getRegistration(event.id).submissions.length, 2)
})

test('event edits are remembered between reads without sharing mutable references', () => {
  const store = createMockWorkspaceStore()
  const event = store.getEvent('spring-live-2026')
  event.sections[0].slots[1] = null
  event.unassigned.push('p2')
  store.rememberEvent(event)
  event.name = '外部から変更'
  assert.notEqual(store.getEvent(event.id).name, event.name)
  assert.equal(store.getEvent(event.id).sections[0].slots[1], null)
  assert.ok(store.getEvent(event.id).unassigned.includes('p2'))
})

test('metadata changes are reflected in the list and event detail', () => {
  const store = createMockWorkspaceStore()
  store.updateDetails('spring-live-2026', {
    name: '更新したイベント',
    status: 'confirmed',
  })
  assert.equal(store.getEvent('spring-live-2026').name, '更新したイベント')
  assert.equal(store.listEvents()[0].status, 'confirmed')
})

test('deleted events are removed from all access paths', () => {
  const store = createMockWorkspaceStore()
  store.deleteEvent('spring-live-2026')
  assert.equal(store.listEvents().length, 2)
  assert.throws(() => store.getEvent('spring-live-2026'), /見つかりません/)
  assert.throws(
    () => store.getRegistration('spring-live-2026'),
    /見つかりません/,
  )
})

test('performance validation and member parsing reject missing or invalid inputs', () => {
  assert.deepEqual(parseMembers(' 佐藤、田中\n佐藤、鈴木 '), [
    '佐藤',
    '田中',
    '鈴木',
  ])
  assert.ok(validatePerformance({ ...draft, name: '  ' }))
  assert.ok(validatePerformance({ ...draft, members: '' }))
  assert.ok(validatePerformance({ ...draft, contact: 'invalid' }))
  assert.equal(validatePerformance(draft), '')
})

test('editing original performances without a form response preserves new notes', () => {
  const store = createMockWorkspaceStore()
  store.updatePerformance('spring-live-2026', 'p4', draft)
  const response = store
    .getRegistration('spring-live-2026')
    .submissions.find((item) => item.performanceId === 'p4')
  assert.equal(response?.requests, draft.requests)
  assert.equal(response?.source, 'manual')
  assert.equal(store.listEvents()[0].responseCount, 3)
})

test('member selection reuses IDs and same names never merge implicitly', () => {
  const store = createMockWorkspaceStore()
  const id = store.addPerformance('spring-live-2026', {
    ...draft,
    memberIds: ['m1'],
    members: '佐藤',
  })
  const event = store.getEvent('spring-live-2026')
  const performance = event.performances.find((item) => item.id === id)!
  assert.equal(performance.memberIds[0], 'm1')
  assert.notEqual(performance.memberIds[1], 'm1')
  assert.equal(
    event.members.find((member) => member.id === performance.memberIds[1])
      ?.name,
    '佐藤',
  )
  assert.throws(
    () => store.addPerformance(event.id, { ...draft, memberIds: ['missing'] }),
    /選び直/,
  )
})

test('referenced bands cannot be deleted and invalid snapshots cannot be saved', () => {
  const store = createMockWorkspaceStore()
  assert.throws(() => store.deletePerformance('spring-live-2026', 'p1'), /制約/)
  const event = store.getEvent('spring-live-2026')
  event.unassigned.push('p1')
  assert.throws(() => store.rememberEvent(event), /欠落・重複/)
  assert.equal(store.getEvent(event.id).unassigned.length, 2)
})

test('member names preserve middle dots rather than splitting one person into two', () => {
  assert.deepEqual(parseMembers('ジョン・スミス、田中'), [
    'ジョン・スミス',
    '田中',
  ])
})
