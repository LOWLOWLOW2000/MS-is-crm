import { redirect } from 'next/navigation'

/** 旧「Office」URL。PJ変更へ統一 */
export default function OfficePage() {
  redirect('/pj-switch')
}
