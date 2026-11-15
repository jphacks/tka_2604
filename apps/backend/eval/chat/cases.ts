import type {
  AIChatInput,
  AIChatOutput,
  ConstraintProposalAction,
  ProposedConstraint,
} from '../../src/services/chat/types.ts'
import {
  BALLAD_BANDS,
  COSTUME_BANDS,
  evalInput,
  LAST_BAND_ID,
  SATO_GAP_ID,
  TANAKA_BANDS,
} from './fixture.ts'

type OutputType = AIChatOutput['type']

export type EvalCase = {
  name: string
  category: string
  input: AIChatInput
  expect: OutputType[]
  // Returns a failure reason, or null when the output is acceptable.
  check?: (output: AIChatOutput) => string | null
}

const constraintsOf = (output: AIChatOutput) =>
  output.actions.flatMap((action: ConstraintProposalAction) =>
    action.type === 'delete_constraint' ? [] : [action.constraint],
  )

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && b.every((id) => a.includes(id))

// Tanaka cannot come to part 3 (sortOrder 2). Either in_range over the other
// parts or a count of 0 in part 3 keeps Tanaka's bands out; only Tanaka's
// bands may be targeted, and the band now in part 3 (b09) must be covered.
function excludesPartThree(output: AIChatOutput) {
  const excluding = constraintsOf(output).filter(
    (c) =>
      (c.type === 'in_range' &&
        c.params.kind === 'parts' &&
        !c.params.part_ids.includes(2)) ||
      (c.type === 'count' &&
        c.params.scope === 'in_parts' &&
        sameSet(c.params.part_ids.map(String), ['2']) &&
        c.params.max === 0),
  )
  const targets = excluding.flatMap((c) =>
    c.type === 'in_range' || c.type === 'count' ? c.targets.band_ids : [],
  )
  if (!targets.includes('b09'))
    return '第3部から田中のバンド(b09)を外す条件がない'
  if (targets.some((id) => !TANAKA_BANDS.includes(id)))
    return `田中以外のバンドを対象にした: ${targets.join(',')}`
  return null
}

function gapBetween(bands: string[]) {
  return (output: AIChatOutput) => {
    const gaps = constraintsOf(output).filter(
      (c): c is Extract<ProposedConstraint, { type: 'min_gap_bands' }> =>
        c.type === 'min_gap_bands',
    )
    const match = gaps.find((c) => sameSet(c.targets.band_ids, bands))
    if (!match)
      return `min_gap_bandsの対象が違う: ${gaps.map((c) => c.targets.band_ids.join(',')).join(' / ') || 'なし'}`
    return match.params.min_diff >= 2 ? null : 'min_diffが2未満'
  }
}

function hasConstraint(type: ProposedConstraint['type']) {
  return (output: AIChatOutput) =>
    constraintsOf(output).some((c) => c.type === type) ? null : `${type}がない`
}

const buttonHistory: AIChatInput['recentMessages'] = [
  { role: 'user', text: '雰囲気で並べ替えて' },
  {
    role: 'assistant',
    text: '出演順の計算は画面の「自動生成」ボタンから行ってください。',
  },
]

function partCountInput() {
  const state = evalInput('部が固定されていない出演枠は何組ある？ 数えて教えて')
  const base = {
    schema_version: '1.0.0' as const,
    event_id: 'eval-event',
    enabled: true,
    type: 'in_range' as const,
    hardness: 'hard' as const,
    priority: null,
    params: { kind: 'parts' as const, part_ids: [0] as [number] },
  }
  state.context.constraints.push(
    { ...base, constraint_id: 'fixed', targets: { band_ids: ['b01', 'b02'] } },
    { ...base, constraint_id: 'duplicate', targets: { band_ids: ['b01'] } },
    {
      ...base,
      constraint_id: 'disabled',
      enabled: false,
      targets: { band_ids: ['b03'] },
    },
    {
      ...base,
      constraint_id: 'soft',
      hardness: 'soft',
      priority: 'high',
      targets: { band_ids: ['b04'] },
    },
    {
      ...base,
      constraint_id: 'multiple',
      targets: { band_ids: ['b05'] },
      params: { kind: 'parts', part_ids: [0, 1] },
    },
  )
  state.recentMessages = [
    { role: 'user', text: '部が固定されていない出演枠は？' },
    { role: 'assistant', text: '集計できません。画面で確認してください。' },
  ]
  return state
}

// A reply type alone is insufficient: the old prompt often returned answer
// while only explaining unsupported settings or redirecting to a button.
function consultationAnswer(topic: RegExp) {
  return (output: AIChatOutput) => {
    if (
      /自動生成.{0,15}(ボタン|押)|対応(していません|できません)|サポート(していません|対象外)/u.test(
        output.message,
      )
    )
      return '相談への回答が機能制限・ボタン案内に置き換わっている'
    return topic.test(output.message) ? null : '質問の内容に答えていない'
  }
}

export const evalCases: EvalCase[] = [
  {
    name: '部固定と未配置を区別して集計',
    category: '集計と既存制約の変更',
    input: partCountInput(),
    expect: ['answer'],
    check: (output) =>
      /10組|１０組|10件/u.test(output.message) &&
      !/集計できません|数えることはできません/u.test(output.message)
        ? null
        : 'hardで部を指定した2組を除く10組を答えていない',
  },
  {
    name: '明示的なhardからsoftへの変更',
    category: '集計と既存制約の変更',
    input: evalInput('佐藤の出演間隔の条件をソフト制約にして'),
    expect: ['approval_required'],
    check: (output) =>
      output.actions.some(
        (a) =>
          a.type === 'update_constraint' &&
          a.constraintId === SATO_GAP_ID &&
          a.constraint.type === 'min_gap_member' &&
          a.constraint.hardness === 'soft' &&
          a.constraint.priority === 'mid' &&
          a.constraint.params.min_diff === 2,
      )
        ? null
        : '既存の佐藤の条件を、優先度midのsoftへ更新していない',
  },
  {
    name: 'ソフト変更の追記で過去の誤回答に従わない',
    category: '集計と既存制約の変更',
    input: evalInput('任意条件にしてということ', {
      recentMessages: [
        { role: 'user', text: '佐藤の出演間隔の条件をソフトにして' },
        {
          role: 'assistant',
          text: '硬さの変更は対応していません。削除して作り直してください。',
        },
      ],
    }),
    expect: ['approval_required'],
    check: (output) =>
      output.actions.some(
        (a) =>
          a.type === 'update_constraint' &&
          a.constraintId === SATO_GAP_ID &&
          a.constraint.hardness === 'soft',
      )
        ? null
        : '対象と変更内容を履歴から補って更新案を返していない',
  },
  // 1. Calculation requests: guide to the button.
  {
    name: '自動生成して',
    category: '計算依頼',
    input: evalInput('今の条件で出演順を自動生成して'),
    expect: ['answer'],
  },
  {
    name: '最適化し直して',
    category: '計算依頼',
    input: evalInput('最適化し直して'),
    expect: ['answer'],
  },

  // 2. Questions.
  {
    name: 'トリは誰',
    category: '質問',
    input: evalInput('今のトリは誰？'),
    expect: ['answer'],
  },
  {
    name: '佐藤の条件',
    category: '質問',
    input: evalInput('佐藤さんの条件ってどうなってる？'),
    expect: ['answer'],
    check: (output) =>
      /1組|１組/u.test(output.message)
        ? null
        : '位置差2を間に1組以上と説明していない',
  },

  // Consultation must remain distinct from requests to change settings.
  ...(
    [
      [
        '転換の相談',
        '転換は何分くらい見ておくといい？',
        /機材|セッティング|音出し|リハ|分/u,
      ],
      ['曲数の相談', '1バンドの持ち時間が20分なら何曲くらいがいい？', /曲|MC/u],
      [
        '休憩の相談',
        'OBOGと現役の合同ライブで、休憩はどう入れるといい？',
        /休憩|部|観客|転換/u,
      ],
      [
        'トリ選びの相談',
        'トリはどういう基準で選ぶのがおすすめ？',
        /盛り上|雰囲気|締め|経験|一体感/u,
      ],
      [
        '出演枠の相談',
        'ネオンサインはトリに向いてると思う？理由も教えて',
        /ダンス|ロック|疾走|テンポ|紹介/u,
      ],
      [
        '未登録の特徴に関する一般相談',
        'メガネのメンバーがいるバンドの照明で気をつけることは？',
        /照明|反射|光/u,
      ],
      [
        '相談への切替',
        '並べ替えは一旦置いておいて、転換をスムーズにするコツを教えて',
        /機材|配置|準備|共有|リハ/u,
      ],
    ] as const
  ).map(([name, message, topic]) => ({
    name,
    category: 'ライブ相談',
    input: evalInput(message, { recentMessages: buttonHistory }),
    expect: ['answer'] as OutputType[],
    check: consultationAnswer(topic),
  })),
  {
    name: '間隔の現状確認',
    category: 'ライブ相談',
    input: evalInput('佐藤の出番は今、間に何組空いてる？'),
    expect: ['answer'],
    check: (output) =>
      /2組|２組/u.test(output.message)
        ? null
        : '現在の配置の間隔（間に2組）を答えていない',
  },
  {
    name: '疑問形の変更依頼',
    category: '相談と変更の境界',
    input: evalInput('ネオンサインを第2部にしてもらえる？'),
    expect: ['approval_required'],
    check: hasConstraint('in_range'),
  },
  {
    name: '相談と条件変更の混在',
    category: '相談と変更の境界',
    input: evalInput(
      '転換をスムーズにするコツを教えて。それと佐藤の出番は間に2組空けて',
    ),
    expect: ['approval_required'],
    check: (output) => {
      const gap = constraintsOf(output).some(
        (c) =>
          c.type === 'min_gap_member' &&
          c.targets.member_id === 'm-sato' &&
          c.params.min_diff === 3,
      )
      return !gap
        ? '佐藤の間隔変更案がない'
        : /機材|準備|共有|リハ/u.test(output.message)
          ? null
          : '転換の相談に答えていない'
    },
  },
  {
    name: 'おすすめの並びを相談',
    category: '相談と変更の境界',
    input: evalInput('紹介をもとに、おすすめの出演順を提案してもらえる？'),
    expect: ['reorder_proposal'],
  },
  {
    name: '不明な曲目を作らない',
    category: 'ライブ相談',
    input: evalInput('ネオンサインは当日どの曲を演奏する予定？'),
    expect: ['answer'],
    check: (output) =>
      /登録|情報|不明|わかりません|分かりません|確認/u.test(output.message)
        ? null
        : '未登録の曲目を不明と説明していない',
  },
  {
    name: '配置だけの入れ替え相談',
    category: '相談と変更の境界',
    input: evalInput(
      '条件は変えず、今のネオンサインとシャボン玉の順番を入れ替えた案を見せて',
    ),
    expect: ['reorder_proposal'],
    check: (output) => {
      if (output.type !== 'reorder_proposal') return '並べ替え案がない'
      const neon = output.placements.find((p) => p.bandId === 'b02')
      const bubble = output.placements.find((p) => p.bandId === 'b04')
      return neon?.partId === 'p1' &&
        neon.order === 3 &&
        bubble?.partId === 'p1' &&
        bubble.order === 1
        ? null
        : '指定した2組の入れ替えになっていない'
    },
  },

  // 3. Wishes and circumstances about specific bands or members.
  {
    name: '田中が3部来れない',
    category: '事情・条件',
    input: evalInput('田中が急きょ3部来れなくなった'),
    expect: ['approval_required'],
    check: excludesPartThree,
  },
  {
    name: '田中が3部無理(口語)',
    category: '事情・条件',
    input: evalInput('田中さん、3部は無理になったって'),
    expect: ['approval_required'],
    check: excludesPartThree,
  },
  {
    name: '田中＋組み直して',
    category: '事情・条件',
    input: evalInput('田中が3部来れなくなったから組み直して'),
    expect: ['approval_required'],
    check: excludesPartThree,
  },
  {
    name: '鈴木の機材遅れ',
    category: '事情・条件',
    input: evalInput(
      '鈴木の機材が遅れて届くから、鈴木のバンドは第1部にしないで',
    ),
    expect: ['approval_required'],
    check: (output) => {
      const ok = constraintsOf(output).some(
        (c) =>
          c.type === 'in_range' &&
          c.targets.band_ids.includes('b03') &&
          c.params.kind === 'parts' &&
          !c.params.part_ids.includes(0),
      )
      return ok ? null : '夜更かし(b03)を第1部以外にするin_rangeがない'
    },
  },
  {
    name: 'ネオンサインを最後に',
    category: '事情・条件',
    input: evalInput('ネオンサインを最後にして'),
    expect: ['approval_required'],
    check: (output) => {
      const ok = constraintsOf(output).some(
        (c) =>
          c.type === 'at_position' &&
          c.targets.band_id === 'b02' &&
          c.params.position === 11,
      )
      if (!ok) return 'ネオンサインを12番にするat_positionがない'
      return output.actions.some(
        (a) => a.type !== 'add_constraint' && a.constraintId === LAST_BAND_ID,
      )
        ? null
        : '既存のトリの条件(ブレイクアウト)を更新・削除していない'
    },
  },
  {
    name: '前後',
    category: '事情・条件',
    input: evalInput('ネオンサインはシャボン玉より後にして'),
    expect: ['approval_required'],
    check: (output) =>
      constraintsOf(output).some(
        (c) =>
          c.type === 'before' &&
          c.targets.before_band_id === 'b04' &&
          c.targets.after_band_id === 'b02',
      )
        ? null
        : 'シャボン玉→ネオンサインのbeforeがない',
  },
  {
    name: '各部バラードは1組まで',
    category: '特徴の条件',
    input: evalInput('バラードは各部1組までにして'),
    expect: ['approval_required'],
    check: (output) =>
      constraintsOf(output).some(
        (c) =>
          c.type === 'count' &&
          sameSet(c.targets.band_ids, BALLAD_BANDS) &&
          c.params.scope === 'per_part' &&
          c.params.max === 1,
      )
        ? null
        : 'バラード3組のper_part max 1のcountがない',
  },
  {
    name: '佐藤の間隔をもっと',
    category: '事情・条件',
    input: evalInput('佐藤の出番の間隔、もっと空けて'),
    expect: ['approval_required', 'clarification_required'],
    check: (output) =>
      output.type === 'clarification_required' ||
      output.actions.some(
        (a) => a.type === 'update_constraint' && a.constraintId === SATO_GAP_ID,
      )
        ? null
        : '既存の佐藤の条件を更新していない',
  },

  // 3'. Wishes whose targets are chosen from band descriptions.
  {
    name: '派手な衣装は隣にしない',
    category: '特徴の条件',
    input: evalInput('派手な衣装のバンドは隣り合わせにしないで'),
    expect: ['approval_required'],
    check: gapBetween(COSTUME_BANDS),
  },
  {
    name: '衣装が派手なとこ連続(口語)',
    category: '特徴の条件',
    input: evalInput('衣装が派手なとこが連続するのはやめたい'),
    expect: ['approval_required'],
    check: gapBetween(COSTUME_BANDS),
  },
  {
    name: 'バラードを続けない',
    category: '特徴の条件',
    input: evalInput('バラード系は続けないで'),
    expect: ['approval_required'],
    check: gapBetween(BALLAD_BANDS),
  },
  {
    name: '同じジャンルを隣にしない',
    category: '特徴の条件',
    input: evalInput('同じジャンルが隣にならないようにして'),
    expect: ['approval_required'],
    check: hasConstraint('min_gap_bands'),
  },

  // 4. Overall flow: the LLM reorders.
  {
    name: '最後が盛り上がる',
    category: '流れ・雰囲気',
    input: evalInput('最後が盛り上がるようにして欲しい'),
    expect: ['reorder_proposal'],
  },
  {
    name: 'だんだん盛り上げる',
    category: '流れ・雰囲気',
    input: evalInput('後半に向けてだんだん盛り上げていきたい'),
    expect: ['reorder_proposal'],
  },
  {
    name: 'メリハリ',
    category: '流れ・雰囲気',
    input: evalInput('全体的にメリハリのある流れにして'),
    expect: ['reorder_proposal'],
  },
  {
    name: 'ノリで',
    category: '流れ・雰囲気',
    input: evalInput('いい感じのノリで並べ替えて'),
    expect: ['reorder_proposal'],
  },
  {
    name: 'しっとり始める',
    category: '流れ・雰囲気',
    input: evalInput('最初はしっとり始めたい'),
    expect: ['reorder_proposal', 'approval_required'],
  },
  {
    name: 'ボタン案内の履歴あり',
    category: '流れ・雰囲気',
    input: evalInput('盛り上がる順に並べ替えて', {
      recentMessages: buttonHistory,
    }),
    expect: ['reorder_proposal'],
  },
  {
    name: '配置が空',
    category: '流れ・雰囲気',
    input: evalInput('最後が盛り上がるようにして', { unplaced: true }),
    expect: ['answer'],
  },

  // 5. Not expressible with the six constraint types.
  {
    name: '時刻指定',
    category: '表せない希望',
    input: evalInput('田中のバンドは18時以降にして'),
    expect: ['answer', 'clarification_required'],
  },
  {
    name: '休憩',
    category: '表せない希望',
    input: evalInput('転換のたびに10分休憩を入れて'),
    expect: ['answer', 'clarification_required'],
  },

  // 6. Cannot identify the target. The UI shows answer and clarification the
  // same way, so either passes as long as no change is proposed.
  {
    name: '同名の山本',
    category: '特定できない',
    input: evalInput('山本の出番を連続にしないで'),
    expect: ['clarification_required', 'answer'],
  },
  {
    name: 'メガネ(情報なし)',
    category: '特定できない',
    input: evalInput('メガネのバンドは隣にしないで'),
    expect: ['clarification_required', 'answer'],
  },
  {
    name: 'あれ',
    category: '特定できない',
    input: evalInput('あれ前にして'),
    expect: ['clarification_required', 'answer'],
  },
]
