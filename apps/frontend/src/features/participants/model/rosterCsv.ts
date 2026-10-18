import type { Member } from '../../../shared/model/event'

export interface RosterRow {
  line: number
  name: string
  /** ジャンル・雰囲気などの紹介。AIの並べ替え案で使う。 */
  description: string | null
  members: string[]
}

export const rosterHeader = '曲名,紹介,メンバー1,メンバー2,…'
const DESCRIPTION_HEADER = '紹介'

/** UTF-8で読めなければShift_JIS（日本語版Excelの既定）として読む。 */
export function decodeCsv(buffer: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('shift_jis').decode(buffer)
  }
}

/** RFC 4180相当。引用符内のカンマ・改行・""を扱う。 */
function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell || row.length) rows.push([...row, cell])
  return rows
}

/**
 * 「曲名,紹介,メンバー1,…」の名簿CSVを読む。1行目は見出し、1行1出演枠。
 * 2列目の見出しが「紹介」でなければ、従来どおり2列目以降を全てメンバーとする。
 * 空欄・前後の空白は無視し、出演枠の入力と同じ上限で検証する。
 */
export function parseRosterCsv(
  text: string,
): { rows: RosterRow[] } | { error: string } {
  const [head, ...body] = parseCsv(text.replace(/^\uFEFF/, ''))
  if (head?.[0]?.trim() !== '曲名')
    return {
      error: `1行目は「${rosterHeader}」の見出しにしてください。`,
    }
  const described = head[1]?.trim() === DESCRIPTION_HEADER
  const rows: RosterRow[] = []
  for (const [index, cells] of body.entries()) {
    const line = index + 2
    const [name = '', ...rest] = cells.map((cell) => cell.trim())
    const description = (described ? rest.shift() : '') || null
    const members = [...new Set(rest.filter(Boolean))]
    if (!name && !members.length && !description) continue
    if (!name) return { error: `${line}行目: 出演名を入力してください。` }
    if (name.length > 80)
      return { error: `${line}行目: 出演名は80文字以内にしてください。` }
    if (!members.length)
      return { error: `${line}行目: メンバーを1名以上入力してください。` }
    if (members.length > 20 || members.some((member) => member.length > 40))
      return {
        error: `${line}行目: メンバーは20名まで、名前は40文字以内にしてください。`,
      }
    // 出演枠の入力は「、」「,」で人を区切るため、名前に含められない。
    if (members.some((member) => /[、,，]/.test(member)))
      return {
        error: `${line}行目: 名前に「、」「,」は使えません。1つのセルに1人ずつ入力してください。`,
      }
    if (description && description.length > 500)
      return { error: `${line}行目: 紹介は500文字以内にしてください。` }
    rows.push({ line, name, description, members })
  }
  if (!rows.length) return { error: '出演枠が1行もありません。' }
  return { rows }
}

/** 取込前の確認用。同じ名前は同じ人として数え、登録済みの人と名前で照合する。 */
export function planRosterImport(rows: RosterRow[], registered: Member[]) {
  const count = new Map<string, number>()
  for (const row of rows)
    for (const name of row.members) count.set(name, (count.get(name) ?? 0) + 1)
  const sameName = (name: string) =>
    registered.filter((member) => member.name === name).length
  const names = [...count.keys()]
  return {
    bands: rows.length,
    people: names.length,
    shared: names.filter((name) => count.get(name)! > 1),
    matched: names.filter((name) => sameName(name) === 1),
    added: names.filter((name) => sameName(name) === 0),
    ambiguous: names.filter((name) => sameName(name) > 1),
  }
}
