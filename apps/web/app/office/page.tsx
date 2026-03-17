/**
 * Office。ヘッダにボタン（左寄せ）・フッター固定。階層: / → /login → /office → /sales-room
 */
export default function OfficePage() {
  return (
    <div className="flex flex-col items-start justify-start p-8">
      <h1 className="mb-2 text-xl font-bold text-gray-900">Office</h1>
      <p className="text-sm text-gray-500">営業ルームへ進む場合はヘッダのボタンから。</p>
    </div>
  )
}
