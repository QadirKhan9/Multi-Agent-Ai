import { getChatResponse, getChatResponseStream } from './chatAgent';
import { runSearchAgent } from './agents/searchAgent';
import { runImageAgent } from './agents/imageAgent';
import { runCodeAgent } from './agents/codeAgent';
import { runPdfAgent } from './agents/pdfAgent';
import { runVoiceAgent } from './agents/voiceAgent';
import { checkRateLimit } from './utils/rateLimiter';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  agentType: string;
  content: string;
  status: 'success' | 'stub' | 'error';
  provider?: string;
  sources?: string;
  imageUrl?: string;
  executionOutput?: string | null;
  fileUrl?: string | null;
  audioUrl?: string | null;
}

const AGENT_FRIENDLY_NAMES: Record<string, string> = {
  chat: "Chat Agent",
  web_search: "Search Agent",
  image_generation: "Image Agent",
  code_generation: "Code Agent",
  pdf_generation: "PDF Agent",
  voice_generation: "Voice Agent",
};

export async function dispatchToAgent(
  intent: string,
  query: string,
  context: ChatMessage[],
  userId: string
): Promise<AgentResponse> {
  // ─── Step 1: Check Rate Limits ──────────────────────────────────────────────
  const rateLimit = await checkRateLimit(userId, intent);
  if (!rateLimit.allowed) {
    console.warn(`[Dispatcher] Rate limit hit for user ${userId} on agent: ${intent}`);
    const name = AGENT_FRIENDLY_NAMES[intent] || intent;
    return {
      agentType: intent,
      content: `⚠️ You've reached today's limit of ${rateLimit.limit} requests for the ${name}. Resets at midnight (current reset time: ${rateLimit.resetTime}).`,
      status: 'error',
    };
  }

  // ─── Step 2: Route to Agents ────────────────────────────────────────────────
  switch (intent) {
    case 'chat':
      try {
        const chatContext = [...context, { role: 'user' as const, content: query }];
        const response = await getChatResponse(chatContext);
        return {
          agentType: 'chat',
          content: response.content,
          status: 'success',
          provider: response.provider,
        };
      } catch (error) {
        return {
          agentType: 'chat',
          content: `⚠️ Error in chat agent: ${(error as Error).message}`,
          status: 'error',
        };
      }

    case 'web_search':
      try {
        return await runSearchAgent(query, context);
      } catch (error) {
        return { agentType: 'web_search', content: `⚠️ Search failed: ${(error as Error).message}`, status: 'error' };
      }

    case 'image_generation':
      try {
        return await runImageAgent(query, userId);
      } catch (error) {
        return { agentType: 'image_generation', content: `⚠️ Image generation failed: ${(error as Error).message}`, status: 'error' };
      }

    case 'pdf_generation':
      try {
        return await runPdfAgent(query, context, userId);
      } catch (error) {
        return { agentType: 'pdf_generation', content: `⚠️ PDF generation failed: ${(error as Error).message}`, status: 'error' };
      }

    case 'code_generation':
      try {
        return await runCodeAgent(query, context);
      } catch (error) {
        return { agentType: 'code_generation', content: `⚠️ Code execution failed: ${(error as Error).message}`, status: 'error' };
      }

    case 'voice_generation':
      try {
        return await runVoiceAgent(query, userId);
      } catch (error) {
        return { agentType: 'voice_generation', content: `⚠️ Voice synthesis failed: ${(error as Error).message}`, status: 'error' };
      }

    default:
      return {
        agentType: 'unknown',
        content: `⚠️ Unrecognized intent: ${intent}.`,
        status: 'error',
      };
  }
}

export async function dispatchToAgentStream(
  intent: string,
  query: string,
  context: ChatMessage[],
  userId: string,
  onChunk?: (chunk: string) => void
): Promise<AgentResponse> {
  const rateLimit = await checkRateLimit(userId, intent);
  if (!rateLimit.allowed) {
    console.warn(`[Dispatcher] Rate limit hit for user ${userId} on agent: ${intent}`);
    const name = AGENT_FRIENDLY_NAMES[intent] || intent;
    return {
      agentType: intent,
      content: `⚠️ You've reached today's limit of ${rateLimit.limit} requests for the ${name}. Resets at midnight (current reset time: ${rateLimit.resetTime}).`,
      status: 'error',
    };
  }

  if (intent === 'chat' && onChunk) {
    try {
      const chatContext = [...context, { role: 'user' as const, content: query }];
      const response = await getChatResponseStream(chatContext, onChunk);
      return {
        agentType: 'chat',
        content: response.content,
        status: 'success',
        provider: response.provider,
      };
    } catch (error) {
      return {
        agentType: 'chat',
        content: `⚠️ Error in chat agent: ${(error as Error).message}`,
        status: 'error',
      };
    }
  }

  return dispatchToAgent(intent, query, context, userId);
}
