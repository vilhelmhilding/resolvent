import { proxyJson } from '@/lib/proxy'

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(req: Request, ctx: Ctx) {
  const { path } = await ctx.params
  return proxyJson(req, `/auth/${path.join('/')}`)
}

export async function POST(req: Request, ctx: Ctx) {
  const { path } = await ctx.params
  return proxyJson(req, `/auth/${path.join('/')}`)
}
