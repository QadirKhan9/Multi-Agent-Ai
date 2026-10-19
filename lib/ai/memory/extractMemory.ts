import prisma from '@/lib/prisma';
import { generateEmbedding } from './embeddings';

interface ExtractionResult {
  facts: string[];
}

import { AI_CONFIG } from '../config';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const EXTRACTION_MODEL = AI_CONFIG.chat.secondary.model; // openai/gpt-oss-20b
const EXTRACTION_TIMEOUT_MS = 12000;

async function extractFactsWithLLM(conversationText: string): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        messages: [
          { role: 'system', content: 'You must output strictly valid JSON. No markdown, no explanation.' },
          {
            role: 'user',
            content: `Analyze the conversation below and extract durable facts about the user worth remembering across sessions.
Avoid temporary facts. Focus on preferences, skills, goals, or identity facts.
Return JSON in exactly this format: {"facts": ["fact 1", "fact 2"]}
If no facts found, return {"facts": []}

Conversation:
${conversationText}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Groq memory extraction error (${response.status}): ${body}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '{"facts":[]}';

    let parsed: ExtractionResult;
    try {
      const jsonStart = rawText.indexOf('{');
      const jsonEnd = rawText.lastIndexOf('}');
      parsed = JSON.parse(jsonStart !== -1 ? rawText.substring(jsonStart, jsonEnd + 1) : rawText);
    } catch {
      return [];
    }

    return Array.isArray(parsed.facts) ? parsed.facts : [];
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as any)?.name === 'AbortError') {
      console.warn('[Memory] Extraction timed out — skipping this round.');
      return [];
    }
    throw err;
  }
}

export async function extractMemoryFromConversation(recentMessages: any[], userId: string) {
  try {
    console.log(`[Memory] Checking conversation for user facts...`);

    const formattedHistory = recentMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 400)}`)
      .join('\n');

    const facts = await extractFactsWithLLM(formattedHistory);

    if (!facts || facts.length === 0) {
      console.log('[Memory] No facts extracted from this chunk.');
      return;
    }

    console.log(`[Memory] Extracted facts:`, facts);

    for (const fact of facts) {
      // 1. Generate embedding
      const embedding = await generateEmbedding(fact);
      const vectorString = `[${embedding.join(',')}]`;

      // 2. Duplicate Check
      const duplicateCheck: any[] = await prisma.$queryRawUnsafe(
        `SELECT "memoryText"
         FROM "UserMemory"
         WHERE "userId" = $1
         AND embedding <=> $2::vector < 0.15
         LIMIT 1`,
        userId,
        vectorString
      );

      if (duplicateCheck.length > 0) {
        console.log(`[Memory] Already remembered (similarity match): "${fact}"`);
        continue;
      }

      // 3. Save memory
      const memoryId = `mem_${Math.random().toString(36).substr(2, 9)}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "UserMemory" (id, "userId", "memoryText", embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        memoryId,
        userId,
        fact,
        vectorString
      );
      console.log(`[Memory] Saved new fact: "${fact}"`);
    }

  } catch (error) {
    // Memory extraction is non-critical — log and continue, never surface to user
    console.error('[Memory] Extraction failed:', error);
  }
}

