import type { NextRequest } from 'next/server'

type ProxyParams = {
  path: string[]
}

const getUpstreamBaseUrl = (): string => {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'
}

const stripTrailingSlash = (s: string): string => {
  return s.endsWith('/') ? s.slice(0, -1) : s
}

const copyRequestHeaders = (req: NextRequest): Headers => {
  const headers = new Headers()

  req.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (k === 'host') return
    if (k === 'connection') return
    if (k === 'content-length') return
    if (k === 'cookie') return
    if (k === 'x-forwarded-for') return
    if (k === 'x-forwarded-host') return
    if (k === 'x-forwarded-proto') return
    if (k === 'accept-encoding') return
    headers.set(key, value)
  })

  return headers
}

const proxy = async (req: NextRequest, { path }: ProxyParams): Promise<Response> => {
  const upstreamBaseUrl = stripTrailingSlash(getUpstreamBaseUrl())
  const upstreamPath = path.join('/')
  const { search } = new URL(req.url)
  const upstreamUrl = `${upstreamBaseUrl}/${upstreamPath}${search}`

  const headers = copyRequestHeaders(req)

  const method = req.method
  const isBodyAllowed = !['GET', 'HEAD'].includes(method)
  const body = isBodyAllowed ? await req.arrayBuffer() : undefined

  const res = await fetch(upstreamUrl, {
    method,
    headers,
    body,
    cache: 'no-store',
    redirect: 'manual',
  })

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  })
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: ProxyParams }) {
  return proxy(req, ctx.params)
}

export async function POST(req: NextRequest, ctx: { params: ProxyParams }) {
  return proxy(req, ctx.params)
}

export async function PUT(req: NextRequest, ctx: { params: ProxyParams }) {
  return proxy(req, ctx.params)
}

export async function PATCH(req: NextRequest, ctx: { params: ProxyParams }) {
  return proxy(req, ctx.params)
}

export async function DELETE(req: NextRequest, ctx: { params: ProxyParams }) {
  return proxy(req, ctx.params)
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

