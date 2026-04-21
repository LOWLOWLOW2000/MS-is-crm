import { Client } from 'pg'
import { Logger } from '@nestjs/common'
import { maskDbUrlPassword, parseDbUrlInfo } from './db-url'

/**
 * API 起動前にDB接続を早期検知する（秘密は出さない）。
 */
export const preflightDbConnection = async (connectionString: string): Promise<void> => {
  const info = parseDbUrlInfo(connectionString)

  Logger.log(
    `DB preflight: host=${info.hostname} port=${info.port ?? '<default>'} db=${info.database ?? '<unset>'} sslmode=${info.sslMode ?? '<unset>'}`,
    'DbPreflight',
  )

  if (info.isSupabase && info.sslMode !== 'require') {
    Logger.warn(
      `Supabase 接続なのに sslmode=require ではありません（現在: ${info.sslMode ?? '<unset>'}）。必要なら DATABASE_URL に ?sslmode=require を付与してください`,
      'DbPreflight',
    )
  }

  if (info.isSupabasePooler) {
    Logger.log(
      'Supabase pooler 検出: migrate/seed は DIRECT_URL（direct host）を推奨します',
      'DbPreflight',
    )
  }

  const client = new Client({ connectionString })
  try {
    await client.connect()
    await client.query('select 1')
    await client.end()
  } catch (e) {
    try {
      await client.end()
    } catch {
      // ignore
    }

    const message = e instanceof Error ? e.message : String(e)
    Logger.error(`DB preflight failed: ${message}`, 'DbPreflight')
    Logger.error(`DATABASE_URL(masked): ${maskDbUrlPassword(connectionString)}`, 'DbPreflight')
    throw e
  }
}

