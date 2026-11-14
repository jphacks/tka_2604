import { expect, it } from 'vitest'

import { parseRosterCsv } from './rosterCsv'
import { rosterTemplate } from './rosterTemplate'

it('downloads a Japanese template that the roster importer can read unchanged', () => {
  const result = parseRosterCsv(rosterTemplate)
  expect(result).toMatchObject({
    rows: [{ name: 'バンド名', members: ['田中', '佐藤'] }],
  })
})
