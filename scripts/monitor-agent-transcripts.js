#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const PROJECT_ID = 'home-mg-ogawa-DevelopmentRoom-my-dev-room-apps-IS-01'
const defaultRoot = path.join(process.env.HOME || '', '.cursor', 'projects', PROJECT_ID, 'agent-transcripts')

const args = process.argv.slice(2)

const getArgValue = (flag) => {
  const index = args.indexOf(flag)
  if (index === -1 || index + 1 >= args.length) return null
  return args[index + 1]
}

const watchCount = Number(getArgValue('--count') || 3)
const intervalMs = Number(getArgValue('--interval') || 1000)
const logRoot = getArgValue('--root') || defaultRoot

/**
 * @param {string} targetRoot
 * @returns {{path: string, mtimeMs: number}[]}
 */
const listJsonlFiles = (targetRoot) => {
  if (!fs.existsSync(targetRoot)) return []

  const firstLevel = fs.readdirSync(targetRoot, { withFileTypes: true })
  return firstLevel
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const folder = path.join(targetRoot, entry.name)
      return fs
        .readdirSync(folder, { withFileTypes: true })
        .filter((child) => child.isFile() && child.name.endsWith('.jsonl'))
        .map((child) => {
          const filePath = path.join(folder, child.name)
          const stat = fs.statSync(filePath)
          return { path: filePath, mtimeMs: stat.mtimeMs }
        })
    })
}

/**
 * @param {unknown} data
 * @returns {string}
 */
const summarizeMessage = (data) => {
  if (!data || typeof data !== 'object') return ''
  const message = data.message
  if (!message || typeof message !== 'object') return ''
  const content = message.content
  if (!Array.isArray(content)) return ''

  const texts = content
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      if (item.type !== 'text') return ''
      const text = typeof item.text === 'string' ? item.text : ''
      return text.replace(/\s+/g, ' ').trim()
    })
    .filter(Boolean)

  return texts.join(' | ').slice(0, 220)
}

/**
 * @param {string} filePath
 * @returns {string}
 */
const shortName = (filePath) => {
  const base = path.basename(filePath, '.jsonl')
  return base.slice(0, 8)
}

const states = new Map()

const printLine = (filePath, line) => {
  if (!line.trim()) return

  try {
    const parsed = JSON.parse(line)
    const role = typeof parsed.role === 'string' ? parsed.role : 'unknown'
    const summary = summarizeMessage(parsed)
    const prefix = `[${shortName(filePath)}][${role}]`

    if (summary) {
      process.stdout.write(`${prefix} ${summary}\n`)
      return
    }
    process.stdout.write(`${prefix} (non-text event)\n`)
  } catch (_error) {
    process.stdout.write(`[${shortName(filePath)}][raw] ${line.slice(0, 180)}\n`)
  }
}

const readNewChunk = (filePath) => {
  const state = states.get(filePath)
  if (!state) return
  if (!fs.existsSync(filePath)) return

  const stat = fs.statSync(filePath)
  if (stat.size < state.offset) {
    state.offset = 0
    state.buffer = ''
  }
  if (stat.size === state.offset) return

  const stream = fs.createReadStream(filePath, { start: state.offset, end: stat.size - 1, encoding: 'utf8' })

  let chunk = ''
  stream.on('data', (data) => {
    chunk += data
  })
  stream.on('end', () => {
    state.offset = stat.size
    const full = state.buffer + chunk
    const lines = full.split('\n')
    state.buffer = lines.pop() || ''
    lines.forEach((line) => printLine(filePath, line))
  })
}

const initialize = () => {
  const jsonlFiles = listJsonlFiles(logRoot).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, watchCount)

  if (!jsonlFiles.length) {
    process.stdout.write(`No transcript files found in: ${logRoot}\n`)
    process.exit(1)
  }

  process.stdout.write(`Watching ${jsonlFiles.length} transcript(s)\n`)
  jsonlFiles.forEach(({ path: filePath }, index) => {
    const size = fs.statSync(filePath).size
    states.set(filePath, { offset: size, buffer: '' })
    process.stdout.write(`${index + 1}. ${filePath}\n`)
  })
  process.stdout.write('--- live ---\n')
}

initialize()
setInterval(() => {
  Array.from(states.keys()).forEach(readNewChunk)
}, intervalMs)
