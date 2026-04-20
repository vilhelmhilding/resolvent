import { proxyJson } from '@/lib/proxy'

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(req: Request, ctx: Ctx) {
  const { path } = await ctx.params
  return proxyJson(req, `/analyses/${path.join('/')}`)
}

export async function PUT(req: Request, ctx: Ctx) {
  const { path } = await ctx.params
  return proxyJson(req, `/analyses/${path.join('/')}`)
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { path } = await ctx.params
  return proxyJson(req, `/analyses/${path.join('/')}`)
}
