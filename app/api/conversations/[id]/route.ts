import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
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

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('[/api/conversations/[id]] GET Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

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

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    // Delete messages first, then the conversation
    await prisma.message.deleteMany({
      where: { conversationId: id },
    });
    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error('[/api/conversations/[id]] DELETE Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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
    const { title } = await req.json();

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ message: 'Title is required' }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { title: title.trim() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[/api/conversations/[id]] PATCH Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
