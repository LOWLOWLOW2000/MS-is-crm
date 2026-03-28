/**
 * 営業ルーム用モックデータ（左右2カラムCRMモック準拠）
 */

import type { CallingResultType } from '@/lib/calling-result-canonical'
import type { ListItem } from '@/lib/types'
import { DEFAULT_HOLD_LIST_ENTRIES } from '@/lib/hold-list-config'

export interface ListCollection {
  id: string
  name: string
  description: string
}

export interface CustomerActivity {
  id: number
  date: string
  type: 'meeting' | 'email' | 'call'
  description: string
}

export interface CustomerDeal {
  id: number
  name: string
  amount: string
  status: string
  date: string
}

/**
 * 本番 `ListItem` と意味が揃うフィールド（モックでは任意）。
 * `listItemId` は API 上の `ListItem.id` に相当。
 * `callingResult` は API の正規名（`CallingResultType`）に限定し、保有リストの `includes` と型整合する。
 */
export type CustomerListItemOverlap = Partial<Pick<ListItem, 'legalEntityId'>> & {
  listItemId?: ListItem['id']
  callingResult?: CallingResultType | null
}

export interface Customer extends CustomerListItemOverlap {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  status: 'active' | 'pending' | 'inactive'
  lastContact: string
  /** 保有リスト（hold id / 架電結果スラッグ）への所属 */
  lists: string[]
  address: string
  company: string
  position: string
  since: string
  revenue: string
  notes: string
  activities: CustomerActivity[]
  deals: CustomerDeal[]
  /** 次回ACT（次回架電・折返し期限など）。近い順に一覧ソート */
  nextActAt?: string | null
}

/** 左セレクト・保有リスト（配布画面の架電結果チェックと同一の正規名） */
export const MOCK_LIST_COLLECTIONS: ListCollection[] = DEFAULT_HOLD_LIST_ENTRIES.map((e) => ({
  id: e.id,
  name: e.label,
  description: `架電結果「${e.label}」が付いた案件`,
}))

const t = (iso: string) => iso

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: '1',
    name: '株式会社山田商事',
    contact: '山田太郎',
    email: 'yamada@example.com',
    phone: '03-1234-5678',
    status: 'active',
    lastContact: '2026-03-01',
    lists: ['appo', 'material'],
    address: '東京都千代田区丸の内1-1-1',
    company: '山田商事グループ',
    position: '営業部長',
    since: '2023-04-15',
    revenue: '¥12,500,000',
    notes: '大口顧客。四半期ごとの定期ミーティングを実施。',
    callingResult: 'アポ',
    nextActAt: t('2026-03-30T14:00:00'),
    activities: [
      { id: 1, date: '2026-03-01', type: 'meeting', description: '四半期レビューミーティング' },
      { id: 2, date: '2026-02-15', type: 'email', description: '新製品の提案メール送信' },
      { id: 3, date: '2026-01-20', type: 'call', description: 'フォローアップ電話' },
    ],
    deals: [
      { id: 1, name: '新製品導入プロジェクト', amount: '¥5,000,000', status: '進行中', date: '2026-02-01' },
      { id: 2, name: '年間保守契約', amount: '¥2,500,000', status: '完了', date: '2025-12-15' },
    ],
  },
  {
    id: '2',
    name: '佐藤エンタープライズ',
    contact: '佐藤花子',
    email: 'sato@example.com',
    phone: '03-2345-6789',
    status: 'active',
    lastContact: '2026-02-28',
    lists: ['recall'],
    address: '東京都渋谷区渋谷2-2-2',
    company: '佐藤グループ',
    position: '取締役',
    since: '2024-01-10',
    revenue: '¥8,300,000',
    notes: '成長中の顧客。追加サービスに関心あり。',
    callingResult: '再架電',
    nextActAt: t('2026-03-28T10:00:00'),
    activities: [
      { id: 1, date: '2026-02-28', type: 'meeting', description: 'サービス拡張の打ち合わせ' },
      { id: 2, date: '2026-02-10', type: 'email', description: '月次レポート送信' },
    ],
    deals: [
      { id: 1, name: 'サービス拡張パッケージ', amount: '¥3,500,000', status: '商談中', date: '2026-02-20' },
    ],
  },
  {
    id: '3',
    name: '鈴木コーポレーション',
    contact: '鈴木次郎',
    email: 'suzuki@example.com',
    phone: '03-3456-7890',
    status: 'pending',
    lastContact: '2026-02-25',
    lists: ['callback'],
    address: '東京都港区六本木3-3-3',
    company: '鈴木ホールディングス',
    position: '部長',
    since: '2023-08-20',
    revenue: '¥6,700,000',
    notes: '追加提案を検討中。次回フォローアップが必要。',
    callingResult: '折り返し依頼',
    nextActAt: t('2026-03-29T16:30:00'),
    activities: [
      { id: 1, date: '2026-02-25', type: 'call', description: '提案内容の確認電話' },
    ],
    deals: [
      { id: 1, name: 'システム導入案件', amount: '¥4,200,000', status: '検討中', date: '2026-02-15' },
    ],
  },
  {
    id: '4',
    name: '田中インダストリーズ',
    contact: '田中美咲',
    email: 'tanaka@example.com',
    phone: '03-4567-8901',
    status: 'active',
    lastContact: '2026-03-03',
    lists: ['material'],
    address: '東京都新宿区西新宿4-4-4',
    company: '田中グループ',
    position: 'マネージャー',
    since: '2025-11-05',
    revenue: '¥9,800,000',
    notes: '新規大口顧客。優先対応が必要。',
    callingResult: '資料送付',
    nextActAt: t('2026-04-01T11:00:00'),
    activities: [
      { id: 1, date: '2026-03-03', type: 'meeting', description: '導入後フォローアップ' },
      { id: 2, date: '2026-02-20', type: 'meeting', description: '初回キックオフミーティング' },
    ],
    deals: [
      { id: 1, name: '大規模導入プロジェクト', amount: '¥7,500,000', status: '進行中', date: '2026-02-10' },
    ],
  },
  {
    id: '5',
    name: '高橋トレーディング',
    contact: '高橋健一',
    email: 'takahashi@example.com',
    phone: '03-5678-9012',
    status: 'inactive',
    lastContact: '2026-01-15',
    lists: ['reception-ng'],
    address: '東京都品川区大崎5-5-5',
    company: '高橋商事',
    position: '課長',
    since: '2022-03-10',
    revenue: '¥3,200,000',
    notes: '長期未接触。再アプローチを検討。',
    callingResult: '受付NG',
    nextActAt: null,
    activities: [
      { id: 1, date: '2026-01-15', type: 'email', description: '定期フォローメール送信' },
    ],
    deals: [],
  },
  {
    id: '6',
    name: '伊藤コマース',
    contact: '伊藤翔太',
    email: 'ito@example.com',
    phone: '03-6789-0123',
    status: 'active',
    lastContact: '2026-03-02',
    lists: ['no-answer'],
    address: '東京都中央区銀座6-6-6',
    company: '伊藤エンタープライズ',
    position: '代表取締役',
    since: '2021-06-01',
    revenue: '¥15,000,000',
    notes: '最重要顧客。定期的なコミュニケーションが必須。',
    callingResult: '未着電',
    nextActAt: t('2026-03-27T09:00:00'),
    activities: [
      { id: 1, date: '2026-03-02', type: 'call', description: '緊急対応の電話' },
      { id: 2, date: '2026-02-25', type: 'meeting', description: '経営層ミーティング' },
    ],
    deals: [
      { id: 1, name: '年間契約更新', amount: '¥8,000,000', status: '商談中', date: '2026-02-28' },
      { id: 2, name: '追加サービス導入', amount: '¥3,500,000', status: '進行中', date: '2026-01-15' },
    ],
  },
  {
    id: '7',
    name: 'クレーム対応デモ株式会社',
    contact: '問題 太郎',
    email: 'claim@example.com',
    phone: '03-9999-0000',
    status: 'pending',
    lastContact: '2026-03-27',
    lists: ['claim'],
    address: '東京都千代田区1-1-1',
    company: 'クレーム対応デモ',
    position: '総務',
    since: '2025-01-01',
    revenue: '¥1,000,000',
    notes: 'クレーム対応ルーム用サンプル。',
    callingResult: 'クレーム',
    nextActAt: t('2026-03-28T13:00:00'),
    activities: [],
    deals: [],
  },
  {
    id: '8',
    name: '未着電テスト商事',
    contact: 'テスト 花子',
    email: 'miss@example.com',
    phone: '03-8888-1111',
    status: 'active',
    lastContact: '2026-03-26',
    lists: ['no-answer'],
    address: '東京都渋谷区1-2-3',
    company: '未着電テスト',
    position: '主任',
    since: '2024-06-01',
    revenue: '¥2,000,000',
    notes: '',
    callingResult: '未着電',
    nextActAt: t('2026-03-31T15:00:00'),
    activities: [],
    deals: [],
  },
  {
    id: '9',
    name: '不在サンプル物流',
    contact: '不在 次郎',
    email: 'absent@example.com',
    phone: '03-7777-2222',
    status: 'pending',
    lastContact: '2026-03-25',
    lists: ['absent'],
    address: '大阪府大阪市1-1-1',
    company: '不在サンプル',
    position: '課長',
    since: '2023-01-01',
    revenue: '¥5,000,000',
    notes: '',
    callingResult: '不在',
    nextActAt: t('2026-03-29T11:30:00'),
    activities: [],
    deals: [],
  },
]

/**
 * 架電結果ラベルごとの件数（モック全件から集計）
 */
export function countCallingResultsInMock(): Record<string, number> {
  return MOCK_CUSTOMERS.reduce<Record<string, number>>((acc, c) => {
    const key = c.callingResult ?? '（未設定）'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}
