import type { AIChatInput, Constraint } from '../../src/services/chat/types.ts'

// A fixed 3-part, 12-band event. Descriptions carry genre, tempo and, for some
// bands, costume, so feature-based wishes have a single correct band set.
const bands = [
  [
    'b01',
    'ひだまり',
    'ウクレレの弾き語り。ゆったりしたテンポで素朴。のどかで癒やされる。',
  ],
  [
    'b02',
    'ネオンサイン',
    'シンセを重ねたダンスロック。速めのテンポで疾走感がある。衣装は全員ネオンカラーのド派手なジャケット。',
  ],
  ['b03', '夜更かし', 'ピアノバラード。遅めのテンポでしっとり切ない。'],
  ['b04', 'シャボン玉', '明るいポップス。中速で華やか。前向きで元気。'],
  [
    'b05',
    'ガレージ',
    'ミクスチャーロック。速いテンポで重いリフ。会場が一体になる熱さ。',
  ],
  ['b06', '月白', '壮大なラブバラード。遅めのテンポで圧倒的な歌唱。感動的。'],
  [
    'b07',
    'ミラーボール',
    'アイドル風ポップス。にぎやかで弾む。衣装はスパンコールのきらきらドレスで派手。',
  ],
  [
    'b08',
    '夕凪',
    'ローファイなシティポップ。中くらいのテンポで気だるいグルーヴ。',
  ],
  ['b09', '雷鳴', 'ダークなロック。速いテンポで鋭いギター。スリリング。'],
  ['b10', '春風', '爽やかなギターポップ。中くらいのテンポで透明感のある歌声。'],
  ['b11', '鎮魂歌', 'ミドルバラード。中くらいのテンポで切なく優しい。'],
  [
    'b12',
    'ブレイクアウト',
    'エレクトロ寄りのダンスロック。速いテンポで激しく踊れる。全身金色の派手な衣装でラスト向き。',
  ],
] as const

export const COSTUME_BANDS = ['b02', 'b07', 'b12']
export const BALLAD_BANDS = ['b03', 'b06', 'b11']
export const TANAKA_BANDS = ['b02', 'b05', 'b09']
export const SATO_GAP_ID = 'c-sato-gap'
export const LAST_BAND_ID = 'c-last-band'

const members = [
  ['m-tanaka', '田中'],
  ['m-sato', '佐藤'],
  ['m-suzuki', '鈴木'],
  ['m-yamamoto-ken', '山本'],
  ['m-yamamoto-aya', '山本'],
  ['m-ito', '伊藤'],
] as const

const memberships = [
  ['b02', 'm-tanaka'],
  ['b05', 'm-tanaka'],
  ['b09', 'm-tanaka'],
  ['b01', 'm-sato'],
  ['b04', 'm-sato'],
  ['b03', 'm-suzuki'],
  ['b06', 'm-yamamoto-ken'],
  ['b08', 'm-yamamoto-ken'],
  ['b10', 'm-yamamoto-aya'],
  ['b11', 'm-yamamoto-aya'],
  ['b07', 'm-ito'],
  ['b12', 'm-ito'],
] as const

const base = {
  schema_version: '1.0.0',
  event_id: 'eval-event',
  enabled: true,
} as const

const constraints: Constraint[] = [
  {
    ...base,
    constraint_id: SATO_GAP_ID,
    type: 'min_gap_member',
    hardness: 'hard',
    priority: null,
    targets: { member_id: 'm-sato' },
    params: { min_diff: 2, same_part_only: false },
  },
  {
    ...base,
    constraint_id: LAST_BAND_ID,
    type: 'at_position',
    hardness: 'soft',
    priority: 'high',
    targets: { band_id: 'b12' },
    params: { position: 11 },
  },
]

const parts = [0, 1, 2].map((sortOrder) => ({
  partId: `p${sortOrder + 1}`,
  sortOrder,
  partName: null,
  bandCount: 4,
}))

export function evalInput(
  userMessage: string,
  options: {
    recentMessages?: AIChatInput['recentMessages']
    unplaced?: boolean
  } = {},
): AIChatInput {
  return {
    context: {
      event: { title: '秋の学内ライブ' },
      parts,
      bands: bands.map(([bandId, bandName, description]) => ({
        bandId,
        bandName,
        description,
      })),
      members: members.map(([memberId, memberName]) => ({
        memberId,
        memberName,
      })),
      memberships: memberships.map(([bandId, memberId]) => ({
        bandId,
        memberId,
      })),
      constraints,
      currentPlacements: options.unplaced
        ? []
        : bands.map(([bandId], index) => ({
            bandId,
            partId: `p${Math.floor(index / 4) + 1}`,
            order: index % 4,
          })),
    },
    recentMessages: options.recentMessages ?? [],
    userMessage,
    pendingProposal: null,
  }
}
