 'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { importCsvList } from '@/lib/calling-api'

type ImportResult = {
  list: { id: string; name: string }
  importedCount: number
  skippedCount: number
}

type SampleCsvFile = {
  fileName: string
  publicUrl: string
  bytes: number
  updatedAt: string
}

const readTextFile = async (file: File): Promise<string> => {
  const text = await file.text()
  return text
}

export default function DirectorCallingListImportPage() {
  const { data: session } = useSession()
  const accessToken = session?.accessToken ?? ''

  const fileRef = useRef<HTMLInputElement>(null)
  const [listName, setListName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [sampleFiles, setSampleFiles] = useState<SampleCsvFile[]>([])
  const [sampleFilesLoading, setSampleFilesLoading] = useState(false)

  const stripCsvExtension = (name: string): string => {
    // "sample.csv" -> "sample"
    return name.toLowerCase().endsWith('.csv') ? name.slice(0, -4) : name
  }

  const canSubmit = useMemo(() => {
    return Boolean(accessToken) && csvText.trim().length > 0
  }, [accessToken, csvText])

  const handlePickFile = () => {
    fileRef.current?.click()
  }

  const refreshSampleFiles = async () => {
    setSampleFilesLoading(true)
    try {
      const res = await fetch('/api/samples/csv', { cache: 'no-store' })
      if (!res.ok) throw new Error('サンプルCSV一覧の取得に失敗しました')
      const data = (await res.json()) as { files: SampleCsvFile[] }
      setSampleFiles(Array.isArray(data.files) ? data.files : [])
    } catch (e) {
      setSampleFiles([])
      setMessage(e instanceof Error ? e.message : 'サンプルCSV一覧の取得に失敗しました')
    } finally {
      setSampleFilesLoading(false)
    }
  }

  const loadSampleFile = async (file: SampleCsvFile) => {
    try {
      const res = await fetch(file.publicUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error(`CSVの取得に失敗しました: ${file.fileName}`)
      const text = await res.text()
      setListName(stripCsvExtension(file.fileName))
      setCsvText(text)
      setMessage(`読み込みました: ${file.fileName}`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'CSVの取得に失敗しました')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setListName(stripCsvExtension(file.name))
      const text = await readTextFile(file)
      setCsvText(text)
      setMessage(`読み込みました: ${file.name}`)
    } catch {
      setMessage('ファイルの読み込みに失敗しました')
    }
  }

  const handleImport = async () => {
    if (!canSubmit) return
    setLoading(true)
    setMessage('')
    setResult(null)
    try {
      const res = await importCsvList(accessToken, { csvText, name: listName.trim() || undefined })
      setResult(res as unknown as ImportResult)
      setMessage(`格納しました: ${res.importedCount}件（スキップ ${res.skippedCount}件）`)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSample = () => {
    setCsvText(
      [
        '会社名,電話番号,住所,企業URL,業種',
        'サンプル株式会社,03-1234-5678,東京都千代田区1-1-1,https://example.com,IT',
        'テスト合同会社,06-1234-0000,大阪府大阪市1-2-3,https://example.org,製造',
      ].join('\n')
    )
    setMessage('サンプルCSVを入力しました')
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">リスト格納</h1>
      <p className="mt-2 text-sm text-gray-600">
        CSV を取り込み、リストとして格納します（`/lists/import-csv`）。ディレクター・管理者ロールが必要です（is_member
        のみのアカウントでは API が拒否します）。
      </p>

      {message && (
        <div className="mt-4 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-900">設定</h2>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-medium text-gray-700">
              リスト名（任意）
              <input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="例: 3月_都内_IT"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePickFile}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                CSVファイルを選ぶ
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                サンプル入力
              </button>
            </div>

            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-800">格納済みCSV（public/samples）</div>
                <button
                  type="button"
                  onClick={refreshSampleFiles}
                  disabled={sampleFilesLoading}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {sampleFilesLoading ? '更新中...' : '一覧更新'}
                </button>
              </div>
              <div className="mt-2 max-h-40 overflow-auto rounded border border-slate-200 bg-white">
                {sampleFilesLoading && sampleFiles.length === 0 ? (
                  <div className="p-2 text-xs text-slate-500">読み込み中...</div>
                ) : sampleFiles.length === 0 ? (
                  <div className="p-2 text-xs text-slate-500">まだ一覧を取得していません（「一覧更新」を押してください）</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {sampleFiles.map((f) => (
                      <li key={f.publicUrl} className="flex items-center justify-between gap-2 p-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-slate-800">{f.fileName}</div>
                          <div className="text-[11px] text-slate-500">
                            {new Date(f.updatedAt).toLocaleString('ja-JP')} / {(f.bytes / 1024).toFixed(1)}KB
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => loadSampleFile(f)}
                            className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                          >
                            読み込む
                          </button>
                          <a
                            href={f.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold text-blue-600 hover:underline"
                          >
                            開く
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={!canSubmit || loading}
              className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? '格納中...' : '格納する'}
            </button>

            {!accessToken && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                ログイン状態が必要です（accessTokenが取得できません）
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">CSV（貼り付け）</h2>
            <span className="text-[11px] text-gray-500">会社名/電話/住所/URL は必須</span>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="ここにCSVを貼り付け"
            className="mt-3 h-[340px] w-full rounded border border-gray-300 p-3 font-mono text-xs leading-relaxed"
          />
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">取り込み結果</h2>
          {result?.list?.id ? (
            <Link
              href={`/director/calling-lists/distribute?listId=${encodeURIComponent(result.list.id)}`}
              className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              このリストを配布へ
            </Link>
          ) : null}
        </div>
        <div className="mt-3 overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-medium text-gray-900">listId</th>
                <th className="px-3 py-2 font-medium text-gray-900">name</th>
                <th className="px-3 py-2 font-medium text-gray-900">imported</th>
                <th className="px-3 py-2 font-medium text-gray-900">skipped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {result ? (
                <tr>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{result.list.id}</td>
                  <td className="px-3 py-2 text-gray-800">{result.list.name}</td>
                  <td className="px-3 py-2 text-gray-800">{result.importedCount}</td>
                  <td className="px-3 py-2 text-gray-800">{result.skippedCount}</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                    まだ取り込み結果はありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}


