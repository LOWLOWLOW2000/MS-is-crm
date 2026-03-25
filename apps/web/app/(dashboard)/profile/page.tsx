'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatHeaderRolesJa } from '@/lib/role-labels'
import type { UserRole } from '@/lib/types'
import { fetchMyProfile, updateMyProfileImage } from '@/lib/calling-api'

/**
 * 全ティア共通のプロフィール設定。表示はセッション由来、保存はモック（API 未接続）。
 */
export default function ProfileSettingsPage() {
  const { data: session, status } = useSession()
  const accessToken = session?.accessToken ?? ''
  const [displayName, setDisplayName] = useState('')
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyDailyDigest, setNotifyDailyDigest] = useState(false)
  const [mockSaved, setMockSaved] = useState(false)

  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string>('')
  const [profileImageLoading, setProfileImageLoading] = useState(false)
  const [profileImageError, setProfileImageError] = useState<string | null>(null)
  const [profileImageMessage, setProfileImageMessage] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.name) setDisplayName(session.user.name)
  }, [session?.user?.name])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const run = async (): Promise<void> => {
      try {
        const me = await fetchMyProfile(accessToken)
        if (cancelled) return
        setProfileImageUrl(me.profileImageUrl)
        setPendingImageDataUrl('')
      } catch (e) {
        if (cancelled) return
        setProfileImageError(e instanceof Error ? e.message : 'プロフィール画像の取得に失敗しました')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      reader.readAsDataURL(file)
    })

  const MAX_INPUT_IMAGE_BYTES = 8 * 1024 * 1024 // リサイズ前の上限（ブラウザ負荷を抑える）
  const MAX_OUTPUT_DATAURL_BYTES = 450 * 1024 // APIに渡す前の目標（base64は膨らむので控えめ）
  const MAX_DIMENSION_PX = 512
  const OUTPUT_MIME: 'image/jpeg' = 'image/jpeg'

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      reader.readAsDataURL(blob)
    })

  /**
   * プロフ写真を事前にリサイズして、dataURL を軽量化してからアップロードします。
   * @param file アップロード元の画像ファイル
   */
  const resizeImageFileToDataUrl = async (
    file: File,
  ): Promise<{ dataUrl: string; blobSize: number }> => {
    if (!file.type.startsWith('image/')) {
      throw new Error('画像ファイルのみ選択できます')
    }
    if (file.size > MAX_INPUT_IMAGE_BYTES) {
      throw new Error('画像サイズが大きすぎます（8MBまで）')
    }

    const loadImage = (): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve(img)
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('画像の読み込みに失敗しました'))
        }
        img.src = url
      })

    const img = await loadImage()
    const srcW = img.naturalWidth || img.width
    const srcH = img.naturalHeight || img.height

    if (!srcW || !srcH) {
      throw new Error('画像の解像度を取得できませんでした')
    }

    const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(srcW, srcH))
    const dstW = Math.max(1, Math.round(srcW * scale))
    const dstH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = dstW
    canvas.height = dstH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('画像処理に失敗しました')
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, dstW, dstH)
    ctx.drawImage(img, 0, 0, dstW, dstH)

    const qualities = [0.85, 0.75, 0.65, 0.55, 0.45]
    let best: { blob: Blob; dataUrl: string } | null = null

    for (const q of qualities) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b),
          OUTPUT_MIME,
          q,
        )
      })
      if (!blob) continue

      const dataUrl = await blobToDataUrl(blob)
      best = { blob, dataUrl }
      if (blob.size <= MAX_OUTPUT_DATAURL_BYTES) {
        return { dataUrl, blobSize: blob.size }
      }
    }

    if (best && best.blob.size <= MAX_OUTPUT_DATAURL_BYTES * 1.25) {
      return { dataUrl: best.dataUrl, blobSize: best.blob.size }
    }

    throw new Error('画像を軽量化できませんでした（別の画像をお試しください）')
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded-md bg-gray-200" />
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-gray-100" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900">プロフィール設定</h1>
        <p className="mt-2 text-sm text-gray-600">設定を表示するにはログインしてください。</p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ログインへ
        </Link>
      </div>
    )
  }

  const u = session.user
  const rolesJa = formatHeaderRolesJa((u.roles ?? [u.role]) as UserRole[])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
      <header className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">プロフィール設定</h1>
        <p className="mt-2 text-sm text-gray-600">
          全ティアで共通の表示名・通知の目安です。所属・役職は管理者設定に従います。
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="アカウント情報"
        >
          <h2 className="text-base font-semibold text-gray-900">アカウント</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-1">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">表示名</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setMockSaved(false)
                }}
                className="mt-1 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="name"
              />
              <span className="mt-1 block text-xs text-gray-500">
                画面上の「自分名」などに使われます（保存はバックエンド接続後に有効化予定）。
              </span>
            </label>
            <div>
              <span className="text-sm font-medium text-gray-700">メールアドレス</span>
              <p className="mt-1 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                {u.email || '未設定'}
              </p>
              <span className="mt-1 block text-xs text-gray-500">ログイン ID のため変更は管理者依頼となります。</span>
            </div>

            <div className="mt-2">
              <span className="text-sm font-medium text-gray-700">プロフ写真</span>
              <div className="mt-3 flex items-start gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                  {profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profileImageUrl} alt="プロフ写真" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      無
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-gray-700"
                    onChange={async (e) => {
                      setProfileImageError(null)
                      setProfileImageMessage(null)
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (!file.type.startsWith('image/')) {
                        setProfileImageError('画像ファイルのみ選択できます')
                        return
                      }
                      try {
                        const res = await resizeImageFileToDataUrl(file)
                        setPendingImageDataUrl(res.dataUrl)
                      } catch (err) {
                        setProfileImageError(err instanceof Error ? err.message : '画像の読み込みに失敗しました')
                      }
                    }}
                  />
                  {pendingImageDataUrl ? (
                    <p className="mt-2 text-xs text-amber-800">未登録の画像があります。下の「登録」で反映します。</p>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">画像を選択するとプレビューが表示されます。</p>
                  )}
                  {profileImageError ? (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {profileImageError}
                    </p>
                  ) : null}
                  {profileImageMessage ? (
                    <p className="mt-2 text-xs text-emerald-700" role="status">
                      {profileImageMessage}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={!pendingImageDataUrl || profileImageLoading || !accessToken}
                    onClick={async () => {
                      setProfileImageError(null)
                      setProfileImageMessage(null)
                      if (!pendingImageDataUrl) return
                      setProfileImageLoading(true)
                      try {
                        const res = await updateMyProfileImage(accessToken, pendingImageDataUrl)
                        setProfileImageUrl(res.profileImageUrl)
                        setPendingImageDataUrl('')
                        setProfileImageMessage('プロフ写真を更新しました')
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new Event('profileImage:changed'))
                        }
                      } catch (err) {
                        setProfileImageError(err instanceof Error ? err.message : '更新に失敗しました')
                      } finally {
                        setProfileImageLoading(false)
                      }
                    }}
                    className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {profileImageLoading ? '更新中…' : '登録'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="所属と役職"
        >
          <h2 className="text-base font-semibold text-gray-900">所属・役職（参照のみ）</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-28 shrink-0 font-medium text-gray-500">所属企業</dt>
              <dd className="text-gray-900">{u.tenantCompanyName || '未設定'}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-28 shrink-0 font-medium text-gray-500">PJ 名</dt>
              <dd className="text-gray-900">{u.tenantProjectName || '未設定'}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-28 shrink-0 font-medium text-gray-500">役職</dt>
              <dd className="text-gray-900">{rolesJa}</dd>
            </div>
          </dl>
        </section>

        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="通知設定"
        >
          <h2 className="text-base font-semibold text-gray-900">通知（モック）</h2>
          <p className="mt-1 text-sm text-gray-500">実装時にメール・Teams 連携と紐づけます。</p>
          <ul className="mt-4 space-y-3">
            <li className="flex items-start gap-3">
              <input
                id="notify-email"
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => {
                  setNotifyEmail(e.target.checked)
                  setMockSaved(false)
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="notify-email" className="text-sm text-gray-800">
                重要なお知らせをメールで受け取る
              </label>
            </li>
            <li className="flex items-start gap-3">
              <input
                id="notify-digest"
                type="checkbox"
                checked={notifyDailyDigest}
                onChange={(e) => {
                  setNotifyDailyDigest(e.target.checked)
                  setMockSaved(false)
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="notify-digest" className="text-sm text-gray-800">
                日次ダイジェスト（KPI・日報サマリー）
              </label>
            </li>
          </ul>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMockSaved(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            保存（モック）
          </button>
          {mockSaved ? (
            <span className="text-sm text-green-700" role="status">
              保存しました（UI のみ。API 未接続）
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
