import type { EventData } from '../../shared/model/event'

const base = {
  schema_version: '1.0.0',
  event_id: 'spring-live-2026',
  hardness: 'hard',
  priority: null,
  enabled: true,
} as const

export const eventFixture: EventData = {
  id: 'spring-live-2026',
  name: '春ライブ 2026',
  members: [
    { id: 'm1', name: '佐藤' },
    { id: 'm2', name: '田中' },
    { id: 'm3', name: '鈴木' },
    { id: 'm4', name: '高橋' },
    { id: 'm5', name: '伊藤' },
    { id: 'm6', name: '渡辺' },
    { id: 'm7', name: '小林' },
    { id: 'm8', name: '加藤' },
    { id: 'm9', name: '木村' },
    { id: 'm10', name: '奥津' },
    { id: 'm11', name: '山内' },
    { id: 'm12', name: '中村' },
    { id: 'm13', name: '井上' },
    { id: 'm14', name: '山本' },
    { id: 'm15', name: '松本' },
    { id: 'm16', name: '林' },
  ],
  performances: [
    {
      id: 'p1',
      name: '気分上々↑↑',
      memberIds: ['m1', 'm2', 'm3', 'm4'],
    },
    {
      id: 'p2',
      name: 'Pretender',
      memberIds: ['m5', 'm6', 'm7', 'm8'],
    },
    { id: 'p3', name: 'VPS', memberIds: ['m9', 'm10', 'm11'] },
    {
      id: 'p4',
      name: '青と夏',
      memberIds: ['m1', 'm12', 'm13', 'm14'],
    },
    {
      id: 'p5',
      name: '月のワルツ',
      memberIds: ['m2', 'm6', 'm15', 'm16'],
    },
    {
      id: 'p6',
      name: '光について',
      memberIds: ['m5', 'm3', 'm13', 'm11'],
    },
    { id: 'p7', name: 'ソロギターメドレー', memberIds: ['m7'] },
    {
      id: 'p8',
      name: 'Everything',
      memberIds: ['m1', 'm4', 'm15', 'm8'],
    },
    {
      id: 'p9',
      name: 'HOT LIMIT',
      memberIds: ['m2', 'm12', 'm14', 'm16'],
    },
    {
      id: 'p10',
      name: 'Hope',
      memberIds: ['m5', 'm6', 'm13', 'm11'],
    },
    {
      id: 'p11',
      name: 'ATTENTION',
      memberIds: ['m3', 'm4', 'm15', 'm8'],
    },
    {
      id: 'p12',
      name: 'ラストソング',
      memberIds: ['m1', 'm7', 'm12', 'm16'],
    },
    {
      id: 'p13',
      name: '源泉掛け流し',
      memberIds: ['m9', 'm10', 'm13', 'm16'],
    },
    {
      id: 'p14',
      name: 'ラブファントム',
      memberIds: ['m5', 'm2', 'm4', 'm14'],
    },
  ],
  sections: [
    { id: 'part-0', slots: ['p1', 'p2', 'p3', 'p4'] },
    { id: 'part-1', slots: ['p5', 'p6', 'p7', 'p8'] },
    { id: 'part-2', slots: ['p9', 'p10', 'p11', 'p12'] },
  ],
  unassigned: ['p13', 'p14'],
  constraints: [
    {
      ...base,
      constraint_id: 'fixed-p1',
      type: 'at_position',
      targets: { band_id: 'p1' },
      params: { position: 0 },
    },
    {
      ...base,
      constraint_id: 'fixed-p5',
      type: 'at_position',
      targets: { band_id: 'p5' },
      params: { position: 4 },
    },
    {
      ...base,
      constraint_id: 'gap-m1',
      type: 'min_gap_member',
      targets: { member_id: 'm1' },
      params: { min_diff: 3, same_part_only: false },
      hardness: 'soft',
      priority: 'high',
    },
    {
      ...base,
      constraint_id: 'last-p12',
      type: 'at_position',
      targets: { band_id: 'p12' },
      params: { position: 11 },
      hardness: 'soft',
      priority: 'mid',
    },
  ],
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      text: '条件は「手動追加」から種類・対象・数値を選んで登録できます。希望や相談はチャットに入力してください。',
    },
  ],
}
