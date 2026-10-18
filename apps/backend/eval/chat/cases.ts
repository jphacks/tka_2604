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

export const evalCases: EvalCase[] = [
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
