'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatHeaderRolesJa } from '@/lib/role-labels'
import type { UserRole } from '@/lib/types'
import {
  changePassword,
  fetchMyProfile,
  updateMyProfile,
  updateMyProfileImage,
} from '@/lib/calling-api'
import { JP_PREFECTURES } from '@/lib/jp-prefectures'

/** 国コード（ISO 3166-1 alpha-2）の主な選択肢 */
const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: 'JP', label: '日本' },
  { code: 'US', label: 'アメリカ' },
  { code: 'GB', label: 'イギリス' },
  { code: 'CN', label: '中国' },
  { code: 'KR', label: '韓国' },
  { code: 'TW', label: '台湾' },
  { code: 'DE', label: 'ドイツ' },
  { code: 'FR', label: 'フランス' },
  { code: 'AU', label: 'オーストラリア' },
  { code: 'CA', label: 'カナダ' },
]

/**
 * 全ティア共通のプロフィール設定。表示名・住所・連絡先・Slack・パスワードは API 連携。
 */
export default function ProfileSettingsPage() {
  const { data: session, status } = useSession()
  const accessToken = session?.accessToken ?? ''
  const [displayName, setDisplayName] = useState('')
  const [countryCode, setCountryCode] = useState<string | null>(null)
  const [prefecture, setPrefecture] = useState('')
  const [mobilePhone, setMobilePhone] = useState('')
  const [slackId, setSlackId] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [profileSaveLoading, setProfileSaveLoading] = useState(false)
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(null)
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyDailyDigest, setNotifyDailyDigest] = useState(false)
  const [mockSaved, setMockSaved] = useState(false)

  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string>('')
  const [profileImageLoading, setProfileImageLoading] = useState(false)
  const [profileImageError, setProfileImageError] = useState<string | null>(null)
  const [profileImageMessage, setProfileImageMessage] = useState<string | null>(null)
  const [profileFetchError, setProfileFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.name && !profileLoaded) setDisplayName(session.user.name)
  }, [session?.user?.name, profileLoaded])

  const loadProfile = async (token: string): Promise<void> => {
    const me = await fetchMyProfile(token)
    setProfileImageUrl(me.profileImageUrl)
    setPendingImageDataUrl('')
    setDisplayName(me.name)
    setCountryCode(me.countryCode)
    setPrefecture(me.prefecture ?? '')
    setMobilePhone(me.mobilePhone ?? '')
    setSlackId(me.slackId ?? '')
    setDepartmentName(me.departmentName ?? '')
    setHasPassword(me.hasPassword)
    setProfileLoaded(true)
    setProfileImageError(null)
    setProfileFetchError(null)
  }

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const run = async (): Promise<void> => {
      try {
        await loadProfile(accessToken)
      } catch (e) {
        if (cancelled) return
        setProfileFetchError(e instanceof Error ? e.message : 'プロフィールの取得に失敗しました')
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
          部署名・表示名・住所・連絡先・Slack・パスワードを設定できます。所属・役職は管理者設定に従います。
        </p>
        {profileFetchError ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>{profileFetchError}</span>
            <button
              type="button"
              onClick={async () => {
                if (!accessToken) return
                try {
                  await loadProfile(accessToken)
                } catch (e) {
                  setProfileFetchError(e instanceof Error ? e.message : 'プロフィールの取得に失敗しました')
                }
              }}
              className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              再読み込み
            </button>
          </div>
        ) : null}
      </header>

      <div className="mt-6 flex flex-col gap-6">
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
          aria-label="アカウント情報"
        >
          <h2 className="text-base font-semibold text-gray-900">アカウント・連絡先</h2>
          <p className="mt-2 text-xs text-gray-500">
            本名（氏・名）は将来の課金用に記録する予定のため、本画面では入力欄を表示していません。
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-1">
            <label className="block max-w-md">
              <span className="text-sm font-medium text-gray-700">部署名</span>
              <input
                type="text"
                value={departmentName}
                onChange={(e) => {
                  setDepartmentName(e.target.value)
                  setProfileSaveMessage(null)
                  setMockSaved(false)
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="organization"
                placeholder="空欄でも構いません"
              />
              <span className="mt-1 block text-xs text-gray-500">任意</span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">表示名</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setProfileSaveMessage(null)
                  setMockSaved(false)
                }}
                className="mt-1 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="nickname"
              />
              <span className="mt-1 block text-xs text-gray-500">
                画面上の「自分名」などに使われます。同一テナント内で重複は保存できません。
              </span>
            </label>
            <div>
              <span className="text-sm font-medium text-gray-700">ログイン ID（メールアドレス）</span>
              <p className="mt-1 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                {u.email || '未設定'}
              </p>
              <span className="mt-1 block text-xs text-gray-500">
                変更はセキュリティ上の理由から管理者または運営依頼となります。
              </span>
            </div>

            <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">国</span>
                <select
                  value={countryCode ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setCountryCode(v === '' ? null : v)
                    setProfileSaveMessage(null)
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">未選択</option>
                  {countryCode &&
                  !COUNTRY_OPTIONS.some((c) => c.code === countryCode) ? (
                    <option value={countryCode}>{countryCode}</option>
                  ) : null}
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">
                  {countryCode === 'JP' ? '都道府県' : '州・県など'}
                </span>
                {countryCode === 'JP' ? (
                  <select
                    value={prefecture}
                    onChange={(e) => {
                      setPrefecture(e.target.value)
                      setProfileSaveMessage(null)
                    }}
                    className="mt-1 w-full max-w-md rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">未選択</option>
                    {JP_PREFECTURES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={prefecture}
                    onChange={(e) => {
                      setPrefecture(e.target.value)
                      setProfileSaveMessage(null)
                    }}
                    placeholder="例: California"
                    className="mt-1 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoComplete="address-level1"
                  />
                )}
                <span className="mt-1 block text-xs text-gray-500">
                  住所は国と県・都道府県レベルまでを想定しています。
                </span>
              </label>
            </div>

            <label className="block max-w-md">
              <span className="text-sm font-medium text-gray-700">電話番号</span>
              <input
                type="tel"
                value={mobilePhone}
                onChange={(e) => {
                  setMobilePhone(e.target.value)
                  setProfileSaveMessage(null)
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="tel"
                placeholder="例: 090-1234-5678"
              />
            </label>

            <label className="block max-w-md">
              <span className="text-sm font-medium text-gray-700">Slack メンバー ID</span>
              <input
                type="text"
                value={slackId}
                onChange={(e) => {
                  setSlackId(e.target.value)
                  setProfileSaveMessage(null)
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="例: U0123ABCDE"
                autoComplete="username"
              />
              <span className="mt-1 block text-xs text-gray-500">
                通知連携やメンション用。Slack のプロフィールから確認できます。
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={profileSaveLoading || !accessToken}
                onClick={async () => {
                  if (!accessToken) return
                  setProfileSaveLoading(true)
                  setProfileSaveError(null)
                  setProfileSaveMessage(null)
                  try {
                    const me = await updateMyProfile(accessToken, {
                      name: displayName.trim(),
                      departmentName: departmentName.trim() ? departmentName.trim() : null,
                      countryCode,
                      prefecture: prefecture.trim() ? prefecture.trim() : null,
                      mobilePhone: mobilePhone.trim() ? mobilePhone.trim() : null,
                      slackId: slackId.trim() ? slackId.trim() : null,
                    })
                    setDisplayName(me.name)
                    setDepartmentName(me.departmentName ?? '')
                    setCountryCode(me.countryCode)
                    setPrefecture(me.prefecture ?? '')
                    setMobilePhone(me.mobilePhone ?? '')
                    setSlackId(me.slackId ?? '')
                    setProfileSaveMessage('プロフィールを保存しました')
                  } catch (err) {
                    setProfileSaveError(err instanceof Error ? err.message : '保存に失敗しました')
                  } finally {
                    setProfileSaveLoading(false)
                  }
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileSaveLoading ? '保存中…' : 'プロフィールを保存'}
              </button>
              {profileSaveMessage ? (
                <span className="text-sm text-emerald-700" role="status">
                  {profileSaveMessage}
                </span>
              ) : null}
              {profileSaveError ? (
                <span className="text-sm text-red-600" role="alert">
                  {profileSaveError}
                </span>
              ) : null}
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
          aria-label="パスワード変更"
        >
          <h2 className="text-base font-semibold text-gray-900">パスワード</h2>
          {hasPassword ? (
            <>
              <p className="mt-1 text-sm text-gray-500">
                メールアドレスとパスワードでログインしている場合のみ変更できます。
              </p>
              <div className="mt-4 grid max-w-md gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">現在のパスワード</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value)
                      setPasswordError(null)
                      setPasswordMessage(null)
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoComplete="current-password"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">新しいパスワード（8文字以上）</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      setPasswordError(null)
                      setPasswordMessage(null)
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoComplete="new-password"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">新しいパスワード（確認）</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setPasswordError(null)
                      setPasswordMessage(null)
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoComplete="new-password"
                  />
                </label>
                <button
                  type="button"
                  disabled={passwordLoading || !accessToken}
                  onClick={async () => {
                    setPasswordError(null)
                    setPasswordMessage(null)
                    if (newPassword.length < 8) {
                      setPasswordError('新しいパスワードは8文字以上にしてください')
                      return
                    }
                    if (newPassword !== confirmPassword) {
                      setPasswordError('確認用のパスワードが一致しません')
                      return
                    }
                    if (!accessToken) return
                    setPasswordLoading(true)
                    try {
                      await changePassword(accessToken, currentPassword, newPassword)
                      setPasswordMessage('パスワードを変更しました。セキュリティのため再ログインします。')
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                      setTimeout(() => {
                        void signOut({ callbackUrl: '/login' })
                      }, 1200)
                    } catch (err) {
                      setPasswordError(err instanceof Error ? err.message : '変更に失敗しました')
                    } finally {
                      setPasswordLoading(false)
                    }
                  }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {passwordLoading ? '変更中…' : 'パスワードを変更'}
                </button>
                {passwordMessage ? (
                  <p className="text-sm text-emerald-700" role="status">
                    {passwordMessage}
                  </p>
                ) : null}
                {passwordError ? (
                  <p className="text-sm text-red-600" role="alert">
                    {passwordError}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              現在のアカウントは OAuth（Google 等）のみのログインです。パスワードは設定されていません。
            </p>
          )}
        </section>

        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="通知設定"
        >
          <h2 className="text-base font-semibold text-gray-900">通知（暫定）</h2>
          <p className="mt-1 text-sm text-gray-500">次フェーズでメール・Teams 連携と紐づけます。</p>
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
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
          >
            通知設定を保存（暫定）
          </button>
          {mockSaved ? (
            <span className="text-sm text-green-700" role="status">
              保存しました（通知のみ暫定）
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
