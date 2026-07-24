import { NextResponse } from 'next/server';
import { routeIntent } from '@/lib/ai/routerAgent';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q');

  if (!q) {
    return NextResponse.json({ message: 'Provide a ?q= parameter to test routing' }, { status: 400 });
  }

  try {
    const decision = await routeIntent(q, []);
    return NextResponse.json(decision);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
