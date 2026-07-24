import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { runVoiceAgent } from '@/lib/ai/agents/voiceAgent';
import { consumeRateLimit } from '@/lib/ai/utils/rateLimiter';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { messageId, text } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ message: 'Text is required' }, { status: 400 });
    }

    // Rate Limit Check
    const rateLimit = await consumeRateLimit(userId, 'voice_generation');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: `Daily rate limit exceeded for voice generation (${rateLimit.limit}/${rateLimit.limit}). Resets at ${rateLimit.resetTime}.` },
        { status: 429 }
      );
    }

    // 1. Generate Voice
    console.log(`[api/voice] Generating on-demand voice for message ${messageId}...`);
    const agentRes = await runVoiceAgent(text.trim(), userId);

    if (agentRes.status !== 'success' || !agentRes.audioUrl) {
      return NextResponse.json({ message: agentRes.content }, { status: 500 });
    }

    // 2. Save audioUrl to the message if messageId is provided
    if (messageId) {
      try {
        await prisma.message.update({
          where: { id: messageId },
          data: { audioUrl: agentRes.audioUrl },
        });
      } catch (dbError) {
        console.error('[api/voice] Failed to update message audioUrl:', dbError);
      }
    }

    return NextResponse.json({
      audioUrl: agentRes.audioUrl,
    });
  } catch (error) {
    console.error('[api/voice] Error:', error);
    return NextResponse.json(
      { message: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
