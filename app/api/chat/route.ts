import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { routeIntent } from '@/lib/ai/routerAgent';
import { dispatchToAgentStream, dispatchToAgent } from '@/lib/ai/dispatcher';
import { AI_CONFIG } from '@/lib/ai/config';
import { retrieveRelevantMemories } from '@/lib/ai/memory/retrieveMemory';
import { extractMemoryFromConversation } from '@/lib/ai/memory/extractMemory';
import { consumeRateLimit } from '@/lib/ai/utils/rateLimiter';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { conversationId, message } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ message: 'Message is required' }, { status: 400 });
    }

    let convId = conversationId;

    if (!convId) {
      const title = message.trim().split(/\s+/).slice(0, 6).join(' ');
      const conversation = await prisma.conversation.create({
        data: {
          userId,
          title: title.length > 60 ? title.substring(0, 60) + '...' : title,
        },
      });
      convId = conversation.id;
    } else {
      const conv = await prisma.conversation.findUnique({
        where: { id: convId },
      });
      if (!conv || conv.userId !== userId) {
        return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
      }
    }

    // Save user message to database
    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'user',
        content: message.trim(),
      },
    });

    const history = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const aiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Create ReadableStream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendSSE = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Status: Initializing & Memory retrieval
          sendSSE({ type: 'status', status: 'Analyzing request & retrieving memories...' });
          
          const memories = await retrieveRelevantMemories(userId, message.trim());
          let memoryPrompt = "";
          if (memories.length > 0) {
            memoryPrompt = `\n\nKnown facts about this user:\n${memories.map(m => `- ${m}`).join('\n')}\nUse this context naturally if relevant.`;
          }

          const fullChatContext: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            { role: 'system', content: AI_CONFIG.systemPrompt + memoryPrompt },
            ...aiMessages
          ];

          // Intent Routing
          sendSSE({ type: 'status', status: 'Routing intent...' });
          const routerDecision = await routeIntent(message.trim(), aiMessages);

          // Deduplicate: ensure at most one "chat" step so we never produce double responses
          const seenIntents = new Set<string>();
          const deduplicatedSteps = routerDecision.steps.filter((step) => {
            if (step.intent === 'chat') {
              if (seenIntents.has('chat')) return false;
              seenIntents.add('chat');
            }
            return true;
          });

          for (const step of deduplicatedSteps) {
            // Check & consume rate limit for this agent
            const rateLimit = await consumeRateLimit(userId, step.intent);
            if (!rateLimit.allowed) {
              const limitMsg = `⚠️ **Daily Rate Limit Exceeded** for **${step.intent}** agent.\n\nYou have used all **${rateLimit.limit}** allowed requests for today. Limit resets at **${rateLimit.resetTime}**.`;
              
              const assistantMessage = await prisma.message.create({
                data: {
                  conversationId: convId,
                  role: 'assistant',
                  content: limitMsg,
                  agentType: step.intent,
                },
              });

              sendSSE({ type: 'intent', agentType: step.intent });
              sendSSE({
                type: 'message_done',
                message: {
                  id: assistantMessage.id,
                  role: 'assistant',
                  content: assistantMessage.content,
                  agentType: step.intent,
                  createdAt: assistantMessage.createdAt,
                  status: 'error',
                },
              });
              continue;
            }

            sendSSE({ type: 'intent', agentType: step.intent });

            if (step.intent === 'chat') {
              // Streaming Chat Response
              let accumulatedContent = '';

              const agentResponse = await dispatchToAgentStream(
                'chat',
                step.extractedQuery,
                fullChatContext,
                userId,
                (token: string) => {
                  accumulatedContent += token;
                  sendSSE({ type: 'token', token, agentType: 'chat' });
                }
              );

              // Persist assistant message to DB
              const assistantMessage = await prisma.message.create({
                data: {
                  conversationId: convId,
                  role: 'assistant',
                  content: agentResponse.content || accumulatedContent,
                  agentType: 'chat',
                },
              });

              sendSSE({
                type: 'message_done',
                message: {
                  id: assistantMessage.id,
                  role: 'assistant',
                  content: assistantMessage.content,
                  agentType: 'chat',
                  createdAt: assistantMessage.createdAt,
                  status: agentResponse.status,
                },
              });
            } else {
              // Non-chat agents (Image, Search, Code, PDF, Voice)
              sendSSE({ type: 'status', status: `Processing with ${step.intent}...` });
              
              const agentResponse = await dispatchToAgent(step.intent, step.extractedQuery, fullChatContext, userId);
              
              let parsedSources: any = undefined;
              if (agentResponse.sources) {
                try {
                  parsedSources = JSON.parse(agentResponse.sources);
                } catch(e) {}
              }

              const assistantMessage = await prisma.message.create({
                data: {
                  conversationId: convId,
                  role: 'assistant',
                  content: agentResponse.content,
                  agentType: agentResponse.agentType,
                  imageUrl: agentResponse.imageUrl,
                  sources: parsedSources,
                  executionOutput: agentResponse.executionOutput,
                  fileUrl: agentResponse.fileUrl,
                  audioUrl: agentResponse.audioUrl,
                },
              });

              sendSSE({
                type: 'message_done',
                message: {
                  id: assistantMessage.id,
                  role: 'assistant',
                  content: assistantMessage.content,
                  agentType: assistantMessage.agentType,
                  createdAt: assistantMessage.createdAt,
                  status: agentResponse.status,
                  imageUrl: assistantMessage.imageUrl,
                  sources: assistantMessage.sources,
                  executionOutput: assistantMessage.executionOutput,
                  fileUrl: assistantMessage.fileUrl,
                  audioUrl: assistantMessage.audioUrl,
                },
              });
            }
          }

          // Update conversation timestamp
          await prisma.conversation.update({
            where: { id: convId },
            data: { updatedAt: new Date() },
          });

          // Background Memory Extraction
          const recentHistory = await prisma.message.findMany({
            where: { conversationId: convId },
            orderBy: { createdAt: 'desc' },
            take: 10,
          });
          recentHistory.reverse();

          extractMemoryFromConversation(recentHistory, userId).catch(err => {
            console.error('[Memory] Background extraction error:', err);
          });

          // Final SSE completion event
          sendSSE({ type: 'done', conversationId: convId });
        } catch (err) {
          console.error('[SSE Stream Error]', err);
          sendSSE({ type: 'error', message: (err as Error).message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[/api/chat] Error:', error);
    return NextResponse.json(
      { message: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
