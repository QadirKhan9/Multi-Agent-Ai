import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id } = await params;

    // Verify ownership
    const memory = await prisma.userMemory.findUnique({
      where: { id },
    });

    if (!memory || memory.userId !== userId) {
      return NextResponse.json({ message: 'Memory not found or unauthorized' }, { status: 404 });
    }

    await prisma.userMemory.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Memory deleted successfully' });
  } catch (error) {
    console.error('[Memories DELETE API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
