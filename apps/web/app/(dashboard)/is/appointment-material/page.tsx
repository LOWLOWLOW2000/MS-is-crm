import { redirect } from 'next/navigation'

/** ブックマーク互換: ワークスペースのフォローアップへ集約 */
export default function IsAppointmentMaterialRedirectPage() {
  redirect('/is/workspace/follow-ups')
}
