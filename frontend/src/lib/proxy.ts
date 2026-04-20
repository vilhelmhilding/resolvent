const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8000'

export async function proxyJson(req: Request, backendPath: string): Promise<Response> {
  const method = req.method
  const cookie = req.headers.get('cookie') ?? ''
  const hasBody = !['GET', 'HEAD', 'DELETE'].includes(method)

  const upstream = await fetch(`${BACKEND}${backendPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(hasBody ? { body: await req.text() } : {}),
  })

  const body = await upstream.text()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const sc = upstream.headers.get('set-cookie')
  if (sc) headers['set-cookie'] = sc

  return new Response(body, { status: upstream.status, headers })
}
