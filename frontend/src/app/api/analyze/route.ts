export async function POST(req: Request) {
  const body = await req.json()
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
  const upstream = await fetch(`${backendUrl}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
