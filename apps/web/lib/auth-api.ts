import type { AuthResponse, UserRole } from './types'

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? 'http://localhost:3001'

export const registerCompany = async (body: {
  email: string
  password?: string
  name: string
  companyName: string
  headOfficeAddress: string
  headOfficePhone: string
  representativeName: string
}): Promise<AuthResponse> => {
  const res = await fetch(`${apiBaseUrl}/auth/register-company`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || '企業登録に失敗しました')
  }
  return res.json() as Promise<AuthResponse>
}

export const validateInvitation = async (token: string): Promise<{
  tenantId: string
  tenantName: string
  email: string
  roles: UserRole[]
  expiresAt: string
}> => {
  const url = new URL(`${apiBaseUrl}/auth/invitations/validate`)
  url.searchParams.set('token', token)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    throw new Error('招待の確認に失敗しました')
  }
  return res.json()
}

export const acceptInvitation = async (body: {
  token: string
  password?: string
  name?: string
}): Promise<AuthResponse> => {
  const res = await fetch(`${apiBaseUrl}/auth/invitations/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || '招待の承諾に失敗しました')
  }
  return res.json() as Promise<AuthResponse>
}

export const createTenantInvitation = async (
  accessToken: string,
  tenantId: string,
  body: { email: string; roles: UserRole[] },
): Promise<{ id: string; expiresAt: string }> => {
  const res = await fetch(`${apiBaseUrl}/tenants/${encodeURIComponent(tenantId)}/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || '招待の作成に失敗しました')
  }
  return res.json()
}

export type TenantInvitationRow = {
  id: string
  email: string
  roles: UserRole[]
  expiresAt: string
  consumedAt: string | null
  createdAt: string
  status: 'pending' | 'expired' | 'used'
}

export const fetchTenantInvitations = async (
  accessToken: string,
  tenantId: string,
): Promise<TenantInvitationRow[]> => {
  const res = await fetch(`${apiBaseUrl}/tenants/${encodeURIComponent(tenantId)}/invitations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || '招待一覧の取得に失敗しました')
  }
  return res.json() as Promise<TenantInvitationRow[]>
}

/** 未使用招待の取り消し（使用済みはAPI側でスキップ） */
export const revokeTenantInvitations = async (
  accessToken: string,
  tenantId: string,
  invitationIds: string[],
): Promise<{ revoked: number }> => {
  const res = await fetch(
    `${apiBaseUrl}/tenants/${encodeURIComponent(tenantId)}/invitations/revoke`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ invitationIds }),
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || '招待の取り消しに失敗しました')
  }
  return res.json() as Promise<{ revoked: number }>
}
