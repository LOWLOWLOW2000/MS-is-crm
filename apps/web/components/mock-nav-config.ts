/** レイヤー権限：インサイドセールス / 管理職 / 共通 / 企業管理者のみ */
export type NavLayer = 'is' | 'director' | 'common' | 'enterprise'

export type MockNavItem = {
  label: string
  href: string
  layer: NavLayer
}

/** App Router の実パス（(dashboard) は URL に含まれない。/dashboard はトップのみ） */
export const MOCK_NAV_ITEMS: MockNavItem[] = [
  { label: '★Overview', href: '/dashboard', layer: 'common' },
  { label: '★架電ルームver1', href: '/sales-room/v2', layer: 'is' },
  { label: '★架電ルームver2', href: '/sales-room', layer: 'is' },
  { label: '★ISワークスペース', href: '/is/workspace', layer: 'is' },
  { label: 'KPIページ（AI）', href: '/kpi', layer: 'common' },
  { label: 'AIスコアカード', href: '/ai-score', layer: 'common' },
  { label: '日報（AI）', href: '/ai-daily', layer: 'common' },
  { label: 'タイムカード', href: '/timecard-invoice?tab=timecard', layer: 'common' },
  { label: '請求書・領収書', href: '/timecard-invoice?tab=invoice', layer: 'common' },
  { label: '★プロフィール設定', href: '/profile', layer: 'common' },
  { label: '★企業管理', href: '/company-admin', layer: 'enterprise' },
  { label: 'プロジェクトKPI', href: '/director/kpi', layer: 'director' },
  { label: 'KPI目標設定', href: '/director/kpi-goals', layer: 'director' },
  { label: 'トークスクリプト編集', href: '/director/talk-scripts', layer: 'director' },
  { label: 'AIレポート', href: '/director/ai-report', layer: 'director' },
  { label: '日報BOX', href: '/director/daily-box', layer: 'director' },
  { label: '★アポ・資料請求管理', href: '/director/requests', layer: 'director' },
  { label: '★報告フォーマット編集', href: '/director/reporting-formats', layer: 'director' },
  { label: '★リスト格納', href: '/director/calling-lists/import', layer: 'director' },
  { label: '★リスト配布・管理', href: '/director/calling-lists/distribute', layer: 'director' },
  { label: '★役職変更・メンバー招待', href: '/admin', layer: 'director' },
  { label: '出勤管理表＆報酬計算', href: '/attendance-payroll', layer: 'director' },
]

/** 左メニューで「工事中」表示し、対応ページは UnderConstructionOverlay 済みの href */
export const MOCK_NAV_UNDER_CONSTRUCTION_HREFS = new Set<string>([
  '/dashboard',
  '/sales-room/v2',
  '/ai-score',
  '/ai-daily',
  '/timecard-invoice?tab=timecard',
  '/timecard-invoice?tab=invoice',
  '/director/kpi',
  '/director/ai-report',
  '/director/daily-box',
])
