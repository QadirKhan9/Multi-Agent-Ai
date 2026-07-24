import prisma from '@/lib/prisma';
import { generateEmbedding } from './embeddings';
import { getChatResponse } from '../chatAgent';

interface ExtractionResult {
  facts: string[];
}

export async function extractMemoryFromConversation(recentMessages: any[], userId: string) {
  try {
    console.log(`[Memory] Checking conversation for user facts...`);
    
    // We format recent messages for the LLM
    const formattedHistory = recentMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = `You are a memory processor. Analyze the conversation history below and extract any durable facts, preferences, or important details about the user that are worth remembering for future conversations.

Avoid temporary facts (like "User is hungry right now").
Focus on long-term values (e.g. "Ahmed prefers Python", "Ahmed is building a Next.js app", "Ahmed likes simple UI").
Ignore details about the AI.

Output strictly valid JSON with this format:
{
  "facts": ["extracted fact 1", "extracted fact 2"]
}

Conversation:
${formattedHistory}`;

    // Use Groq/Gemini to extract
    const response = await getChatResponse([
      { role: 'system', content: 'You must output strictly JSON.' },
      { role: 'user', content: prompt }
    ], 'Memory Extraction');

    let parsed: ExtractionResult;
    try {
      // Find JSON block if LLM returned markdown
      let jsonText = response.content.trim();
      const jsonStart = jsonText.indexOf('{');
      const jsonEnd = jsonText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
      }
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.warn('[Memory] Failed to parse extracted facts JSON:', response.content);
      return;
    }

    if (!parsed.facts || !Array.isArray(parsed.facts) || parsed.facts.length === 0) {
      console.log('[Memory] No facts extracted from this chunk.');
      return;
    }

    console.log(`[Memory] Extracted facts:`, parsed.facts);

    for (const fact of parsed.facts) {
      // 1. Generate embedding
      const embedding = await generateEmbedding(fact);
      const vectorString = `[${embedding.join(',')}]`;

      // 2. Duplicate Check: Retrieve similar facts from this user
      // Check if cosine distance is close (< 0.15 distance => > 0.85 similarity)
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
        console.log(`[Memory] Fact already remembered (similarity match): "${fact}"`);
        continue;
      }

      // 3. Save memory using raw insert since pgvector isn't supported by prisma client natively
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
    console.error('[Memory] Extraction failed:', error);
  }
}
