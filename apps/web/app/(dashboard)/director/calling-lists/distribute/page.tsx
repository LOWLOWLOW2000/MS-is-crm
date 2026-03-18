import { Suspense } from 'react'
import { DistributeClient } from './DistributeClient'

export default function DirectorCallingListDistributePage({
  searchParams,
}: {
  searchParams?: { listId?: string }
}) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-gray-500">
          読み込み中...
        </div>
      }
    >
      <DistributeClient initialListId={searchParams?.listId} />
    </Suspense>
  )
}

