import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

type SampleCsvFile = {
  /** `public/samples/...` からの相対パス */
  fileName: string
  /** ブラウザで直接取得できる公開パス */
  publicUrl: string
  bytes: number
  updatedAt: string
}

export const GET = async () => {
  try {
    const samplesDir = path.join(process.cwd(), 'public', 'samples')
    const entries = await fs.readdir(samplesDir, { withFileTypes: true })

    const files = await Promise.all(
      entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.csv'))
        .map(async (e): Promise<SampleCsvFile> => {
          const full = path.join(samplesDir, e.name)
          const st = await fs.stat(full)
          return {
            fileName: e.name,
            publicUrl: `/samples/${encodeURIComponent(e.name)}`,
            bytes: st.size,
            updatedAt: st.mtime.toISOString(),
          }
        }),
    )

    const sorted = files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.fileName.localeCompare(b.fileName, 'ja'))

    return NextResponse.json({ files: sorted })
  } catch (e) {
    return NextResponse.json(
      { files: [], error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}

