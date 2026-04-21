/**
 * DB 接続URLを安全に扱うユーティリティ（秘密をログに出さないため）。
 */
export type DbUrlInfo = Readonly<{
  hostname: string
  port: string | null
  database: string | null
  sslMode: string | null
  isSupabase: boolean
  isSupabasePooler: boolean
}>

export const parseDbUrlInfo = (connectionString: string): DbUrlInfo => {
  const url = new URL(connectionString)
  const database = url.pathname.replace(/^\//, '') || null
  const sslMode = url.searchParams.get('sslmode')
  const hostname = url.hostname
  const isSupabase = hostname.endsWith('.supabase.com') || hostname.endsWith('.supabase.co')
  const isSupabasePooler = hostname.includes('.pooler.supabase.')

  return {
    hostname,
    port: url.port || null,
    database,
    sslMode,
    isSupabase,
    isSupabasePooler,
  }
}

/**
 * password をマスクして、ログ出力しても安全な接続文字列にする。
 */
export const maskDbUrlPassword = (connectionString: string): string => {
  try {
    const url = new URL(connectionString)
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    return '<invalid_database_url>'
  }
}

