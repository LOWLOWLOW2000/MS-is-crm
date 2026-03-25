import Link from 'next/link'
import { redirect } from 'next/navigation'

/**
 * ディレクター（プロジェクト）。左ナビ「ディレクター」のメイン。1カラム。
 */
export default function DirectorPage() {
  // /director は要件により「抹消（中身も削除）」のため、最上位に近い画面へリダイレクト
  redirect('/director/kpi')
}
