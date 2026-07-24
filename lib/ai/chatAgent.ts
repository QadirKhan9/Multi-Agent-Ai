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

async function callGroq(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const response = await fetch(AI_CONFIG.chat.primary.apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_CONFIG.chat.primary.model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(30000), // 30s timeout
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

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

async function callGroqStream(messages: ChatMessage[], onChunk: (chunk: string) => void): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const response = await fetch(AI_CONFIG.chat.primary.apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_CONFIG.chat.primary.model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
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
          const token = json.choices?.[0]?.delta?.content || '';
          if (token) {
            fullContent += token;
            onChunk(token);
          }
        } catch (e) {
          // ignore parse errors on partial lines
        }
      }
    }
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse&key=${apiKey}`;

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
  return withFallback(
    async () => {
      const content = await callGroq(messages);
      return { content, provider: 'groq' };
    },
    async () => {
      const content = await callGemini(messages);
      return { content, provider: 'gemini' };
    },
    agentName
  );
}

export async function getChatResponseStream(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void
): Promise<ChatResponse> {
  return withFallback(
    async () => {
      const content = await callGroqStream(messages, onChunk);
      return { content, provider: 'groq' };
    },
    async () => {
      const content = await callGeminiStream(messages, onChunk);
      return { content, provider: 'gemini' };
    },
    'Chat Agent Streaming'
  );
}
