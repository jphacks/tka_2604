export const colors = [
  {
    value: 'blue',
    label: 'ブルー',
    background: '#eaf2ff',
    foreground: '#276aca',
  },
  {
    value: 'violet',
    label: 'パープル',
    background: '#f0eaff',
    foreground: '#7446b5',
  },
  {
    value: 'green',
    label: 'グリーン',
    background: '#e4f5ee',
    foreground: '#28765c',
  },
  {
    value: 'amber',
    label: 'アンバー',
    background: '#fff3d9',
    foreground: '#946213',
  },
  {
    value: 'rose',
    label: 'ローズ',
    background: '#ffe9ef',
    foreground: '#b43c64',
  },
  {
    value: 'slate',
    label: 'グレー',
    background: '#edf0f5',
    foreground: '#526176',
  },
] as const

export type Profile = {
  displayName: string
  avatarText: string
  avatarColor: (typeof colors)[number]['value']
}
