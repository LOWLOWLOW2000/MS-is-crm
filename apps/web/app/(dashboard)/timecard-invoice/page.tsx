import { UnderConstructionOverlay } from '@/components/UnderConstructionOverlay'

/**
 * タイムカード＆請求書・領収書。左ナビ対応。1カラム。
 *
 * 左ナビの分割に対応し、`?tab=timecard|invoice` で表示を切り替えます。
 */
export default function TimecardInvoicePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  type TabKey = 'timecard' | 'invoice' | 'all'
  const rawTab = searchParams?.tab
  const tab = (() => {
    if (rawTab === 'timecard') return 'timecard'
    if (rawTab === 'invoice') return 'invoice'
    return 'all'
  })() as TabKey

  const heading =
    tab === 'timecard' ? 'タイムカード' : tab === 'invoice' ? '請求書・領収書' : 'タイムカード＆請求書・領収書'

  const description =
    tab === 'timecard'
      ? '打刻・勤怠の確認を行います。（モック）'
      : tab === 'invoice'
        ? '請求書・領収書の一覧・発行・ダウンロードを行います。（モック）'
        : '打刻・勤怠と請求書・領収書の確認・発行を行います。（モック）'

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">{heading}</h1>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
      {tab !== 'invoice' ? (
        <UnderConstructionOverlay ariaLabel="タイムカードは準備中です" markSize="compact">
          <section
            className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            aria-label="タイムカード・請求メイン"
          >
            <h2 className="text-base font-semibold text-gray-900">タイムカード</h2>
            <p className="mt-2 text-sm text-gray-500">
              出退勤打刻・勤怠一覧。（モック）
            </p>
            <div className="mt-4 min-h-[120px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
              打刻・勤怠エリア
            </div>
          </section>
        </UnderConstructionOverlay>
      ) : null}
      {tab !== 'timecard' ? (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="請求書・領収書">
          <h2 className="text-base font-semibold text-gray-900">請求書・領収書</h2>
          <p className="mt-2 text-sm text-gray-500">
            請求書・領収書の一覧・発行・ダウンロード。（モック）
          </p>
          <div className="mt-4 min-h-[120px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
            請求書・領収書エリア
          </div>
        </section>
      ) : null}
    </div>
  )
}
