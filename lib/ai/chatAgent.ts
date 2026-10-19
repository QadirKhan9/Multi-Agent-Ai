import { AI_CONFIG } from './config';
import { withFallback } from './utils/withFallback';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  content: string;
  provider: string;
}

async function callGroq(messages: ChatMessage[], model?: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const chosenModel = model || AI_CONFIG.chat.primary.model;

  const response = await fetch(AI_CONFIG.chat.primary.apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: chosenModel,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || data.choices[0]?.message?.reasoning || '';
}

async function callGemini(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  // Use the stable non-aliased model ID
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.chat.fallback.model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGroqStream(messages: ChatMessage[], onChunk: (chunk: string) => void, model?: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const chosenModel = model || AI_CONFIG.chat.primary.model;

  const response = await fetch(AI_CONFIG.chat.primary.apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: chosenModel,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  if (!response.body) throw new Error('No response body from Groq stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullContent = '';
  let fullReasoning = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;

      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta;
          const token = delta?.content || '';
          if (token) {
            fullContent += token;
            onChunk(token);
          } else if (delta?.reasoning) {
            fullReasoning += delta.reasoning;
          }
        } catch (e) {
          // ignore parse errors on partial lines
        }
      }
    }
  }

  // If the reasoning model only returned reasoning without separate content, emit reasoning
  if (!fullContent && fullReasoning) {
    fullContent = fullReasoning;
    onChunk(fullReasoning);
  }

  return fullContent;
}

async function callGeminiStream(messages: ChatMessage[], onChunk: (chunk: string) => void): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.chat.fallback.model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  if (!response.body) throw new Error('No response body from Gemini stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const token = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (token) {
            fullContent += token;
            onChunk(token);
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  }

  return fullContent;
}

export async function getChatResponse(
  messages: ChatMessage[],
  agentName = 'Chat Agent'
): Promise<ChatResponse> {
  // 3-tier fallback: GPT-OSS 120B -> GPT-OSS 20B -> Gemini 2.0 Flash
  try {
    const content = await callGroq(messages); // Primary (GPT-OSS 120B)
    return { content, provider: 'groq-gpt-oss-120b' };
  } catch (primaryErr) {
    console.warn(`[${agentName}] Primary (GPT-OSS 120B) failed:`, (primaryErr as Error).message);
    try {
      const content = await callGroq(messages, AI_CONFIG.chat.secondary.model); // Secondary (GPT-OSS 20B)
      return { content, provider: 'groq-gpt-oss-20b' };
    } catch (secondaryErr) {
      console.warn(`[${agentName}] Secondary (GPT-OSS 20B) failed:`, (secondaryErr as Error).message);
      try {
        const content = await callGemini(messages); // Gemini 2.0 Flash
        return { content, provider: 'gemini' };
      } catch (fallbackErr) {
        console.error(`[${agentName}] All providers failed.`);
        throw new Error(`${agentName} is temporarily unavailable. Please try again in a moment.`);
      }
    }
  }
}

export async function getChatResponseStream(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void
): Promise<ChatResponse> {
  // 3-tier streaming fallback: GPT-OSS 120B -> GPT-OSS 20B -> Gemini 2.0 Flash
  try {
    const content = await callGroqStream(messages, onChunk);
    return { content, provider: 'groq-gpt-oss-120b' };
  } catch (primaryErr) {
    console.warn('[Chat Agent Streaming] Primary (GPT-OSS 120B) failed:', (primaryErr as Error).message);
    try {
      const content = await callGroqStream(messages, onChunk, AI_CONFIG.chat.secondary.model);
      return { content, provider: 'groq-gpt-oss-20b' };
    } catch (secondaryErr) {
      console.warn('[Chat Agent Streaming] Secondary (GPT-OSS 20B) failed:', (secondaryErr as Error).message);
      try {
        const content = await callGeminiStream(messages, onChunk);
        return { content, provider: 'gemini' };
      } catch (fallbackErr) {
        console.error('[Chat Agent Streaming] All providers failed.');
        throw new Error('Chat Agent Streaming is temporarily unavailable. Please try again in a moment.');
      }
    }
  }
}
