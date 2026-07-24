import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const memories = await prisma.userMemory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        memoryText: true,
        createdAt: true,
      }
    });

    return NextResponse.json(memories);
  } catch (error) {
    console.error('[Memories API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
