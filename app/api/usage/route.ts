import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRateLimitStats } from '@/lib/ai/utils/rateLimiter';

const AGENT_TYPES = [
  'chat',
  'web_search',
  'image_generation',
  'code_generation',
  'pdf_generation',
  'voice_generation',
] as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const usageData: Record<string, any> = {};

    for (const agent of AGENT_TYPES) {
      const stats = await getRateLimitStats(userId, agent);
      const used = stats.limit - stats.remaining;
      usageData[agent] = {
        limit: stats.limit,
        used: Math.max(0, used),
        remaining: stats.remaining,
        resetTime: stats.resetTime,
      };
    }

    return NextResponse.json({
      userId,
      date: new Date().toISOString().split('T')[0],
      agents: usageData,
    });
  } catch (error) {
    console.error('[/api/usage] Error:', error);
    return NextResponse.json(
      { message: 'Failed to fetch usage stats' },
      { status: 500 }
    );
  }
}
