/**
 * 営業ルーム用モックデータ（左右2カラムCRMモック準拠）
 */

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

export interface Customer {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  status: 'active' | 'pending' | 'inactive'
  lastContact: string
  lists: string[]
  address: string
  company: string
  position: string
  since: string
  revenue: string
  notes: string
  activities: CustomerActivity[]
  deals: CustomerDeal[]
}

export const MOCK_LIST_COLLECTIONS: ListCollection[] = [
  { id: 'recall', name: '再架電', description: 'フォローアップが必要な顧客' },
  { id: 'history3days', name: '架電履歴（過去3日）', description: '直近3日間の架電記録' },
  { id: 'all', name: '全ての顧客', description: '全顧客リスト' },
  { id: 'vip', name: 'VIP顧客', description: '重要顧客のリスト' },
  { id: 'new', name: '新規顧客', description: '新規獲得顧客' },
  { id: 'sales', name: '営業チームA', description: '営業チームA担当' },
  { id: 'inactive', name: '休眠顧客', description: '長期未接触顧客' },
]

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: '1',
    name: '株式会社山田商事',
    contact: '山田太郎',
    email: 'yamada@example.com',
    phone: '03-1234-5678',
    status: 'active',
    lastContact: '2026-03-01',
    lists: ['all', 'vip', 'sales', 'history3days'],
    address: '東京都千代田区丸の内1-1-1',
    company: '山田商事グループ',
    position: '営業部長',
    since: '2023-04-15',
    revenue: '¥12,500,000',
    notes: '大口顧客。四半期ごとの定期ミーティングを実施。',
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
    lists: ['all', 'new', 'sales', 'recall', 'history3days'],
    address: '東京都渋谷区渋谷2-2-2',
    company: '佐藤グループ',
    position: '取締役',
    since: '2024-01-10',
    revenue: '¥8,300,000',
    notes: '成長中の顧客。追加サービスに関心あり。',
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
    lists: ['all', 'sales', 'recall'],
    address: '東京都港区六本木3-3-3',
    company: '鈴木ホールディングス',
    position: '部長',
    since: '2023-08-20',
    revenue: '¥6,700,000',
    notes: '追加提案を検討中。次回フォローアップが必要。',
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
    lists: ['all', 'vip', 'new', 'history3days'],
    address: '東京都新宿区西新宿4-4-4',
    company: '田中グループ',
    position: 'マネージャー',
    since: '2025-11-05',
    revenue: '¥9,800,000',
    notes: '新規大口顧客。優先対応が必要。',
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
    lists: ['all', 'inactive'],
    address: '東京都品川区大崎5-5-5',
    company: '高橋商事',
    position: '課長',
    since: '2022-03-10',
    revenue: '¥3,200,000',
    notes: '長期未接触。再アプローチを検討。',
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
    lists: ['all', 'vip', 'history3days', 'recall'],
    address: '東京都中央区銀座6-6-6',
    company: '伊藤エンタープライズ',
    position: '代表取締役',
    since: '2021-06-01',
    revenue: '¥15,000,000',
    notes: '最重要顧客。定期的なコミュニケーションが必須。',
    activities: [
      { id: 1, date: '2026-03-02', type: 'call', description: '緊急対応の電話' },
      { id: 2, date: '2026-02-25', type: 'meeting', description: '経営層ミーティング' },
    ],
    deals: [
      { id: 1, name: '年間契約更新', amount: '¥8,000,000', status: '商談中', date: '2026-02-28' },
      { id: 2, name: '追加サービス導入', amount: '¥3,500,000', status: '進行中', date: '2026-01-15' },
    ],
  },
]
