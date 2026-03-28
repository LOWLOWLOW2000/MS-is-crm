/**
 * ディレクター管理トークスクリプト（API の JSON）を表示用に解釈する。
 */

export interface TalkScriptLinearBlock {
  title: string
  body: string
}

export interface TalkScriptLinearContent {
  blocks: TalkScriptLinearBlock[]
}

export interface TalkScriptBranchChoice {
  label: string
  /** 終了は null */
  nextNodeId: string | null
}

export interface TalkScriptBranchNode {
  id: string
  title: string
  body: string
  choices: TalkScriptBranchChoice[]
}

export interface TalkScriptBranchingContent {
  nodes: TalkScriptBranchNode[]
  startNodeId: string
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * API の content を線形スクリプトとして解釈する
 */
export const parseTalkScriptLinear = (raw: unknown): TalkScriptLinearContent | null => {
  if (!isRecord(raw)) return null
  const blocks = raw.blocks
  if (!Array.isArray(blocks) || blocks.length === 0) return null
  const parsed: TalkScriptLinearBlock[] = blocks
    .map((b) => {
      if (!isRecord(b)) return null
      const title = typeof b.title === 'string' ? b.title : ''
      const body = typeof b.body === 'string' ? b.body : ''
      return { title, body }
    })
    .filter((x): x is TalkScriptLinearBlock => x !== null)
  return parsed.length > 0 ? { blocks: parsed } : null
}

/**
 * API の content を分岐スクリプトとして解釈する
 */
export const parseTalkScriptBranching = (raw: unknown): TalkScriptBranchingContent | null => {
  if (!isRecord(raw)) return null
  const startNodeId = typeof raw.startNodeId === 'string' ? raw.startNodeId : ''
  const nodesRaw = raw.nodes
  if (!startNodeId || !Array.isArray(nodesRaw)) return null
  const nodes: TalkScriptBranchNode[] = nodesRaw
    .map((n) => {
      if (!isRecord(n)) return null
      const id = typeof n.id === 'string' ? n.id : ''
      const title = typeof n.title === 'string' ? n.title : ''
      const body = typeof n.body === 'string' ? n.body : ''
      const choicesRaw = n.choices
      if (!id || !Array.isArray(choicesRaw)) return null
      const choices: TalkScriptBranchChoice[] = choicesRaw
        .map((c) => {
          if (!isRecord(c)) return null
          const label = typeof c.label === 'string' ? c.label : ''
          const nextNodeId =
            c.nextNodeId === null || typeof c.nextNodeId === 'string' ? c.nextNodeId : null
          return { label, nextNodeId }
        })
        .filter((x): x is TalkScriptBranchChoice => x !== null)
      return { id, title, body, choices }
    })
    .filter((x): x is TalkScriptBranchNode => x !== null)
  return nodes.length > 0 ? { nodes, startNodeId } : null
}

export const defaultLinearTalkScriptContent = (): TalkScriptLinearContent => ({
  blocks: [
    { title: '章 1', body: '冒頭のトークを入力してください。' },
    { title: '章 2', body: '本題に入るトークを入力してください。' },
  ],
})

export const defaultBranchingTalkScriptContent = (): TalkScriptBranchingContent => ({
  startNodeId: 'n1',
  nodes: [
    {
      id: 'n1',
      title: '開始',
      body: '最初のノードです。選択肢で次に進みます。',
      choices: [
        { label: '詳しく聞く', nextNodeId: 'n2' },
        { label: '終了', nextNodeId: null },
      ],
    },
    {
      id: 'n2',
      title: '詳細',
      body: '詳細説明のトークです。',
      choices: [{ label: '戻る', nextNodeId: 'n1' }],
    },
  ],
})
