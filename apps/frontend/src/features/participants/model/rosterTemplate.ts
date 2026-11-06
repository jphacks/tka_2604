import { downloadCsv } from '../../../shared/ui/download'

export const rosterTemplate =
  '\uFEFF曲名,紹介,メンバー1,メンバー2\r\nバンド名,バンドの紹介,田中,佐藤\r\n'
export function downloadRosterTemplate() {
  downloadCsv('名簿テンプレート.csv', rosterTemplate)
}
