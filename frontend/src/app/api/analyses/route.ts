import { proxyJson } from '@/lib/proxy'

export async function GET(req: Request)    { return proxyJson(req, '/analyses') }
export async function POST(req: Request)   { return proxyJson(req, '/analyses') }
export async function DELETE(req: Request) { return proxyJson(req, '/analyses') }
