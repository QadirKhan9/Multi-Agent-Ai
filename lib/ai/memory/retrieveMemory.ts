import prisma from '@/lib/prisma';
import { generateEmbedding } from './embeddings';

export async function retrieveRelevantMemories(userId: string, currentMessage: string, topK: number = 5): Promise<string[]> {
  try {
    const queryVector = await generateEmbedding(currentMessage);
    
    // Convert array to pgvector string format e.g. '[0.1, 0.2, ...]'
    const vectorString = `[${queryVector.join(',')}]`;

    // Query UserMemory ordered by cosine distance (embedding <=> queryVector)
    // Cosine distance = 1 - cosine similarity. 
    // Small distance = high similarity.
    const results: any[] = await prisma.$queryRawUnsafe(
      `SELECT "memoryText"
       FROM "UserMemory"
       WHERE "userId" = $1
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      userId,
      vectorString,
      topK
    );

    const memories = results.map(r => r.memoryText);
    console.log(`[Memory] Retrieved ${memories.length} relevant memories for user ${userId}.`);
    return memories;
  } catch (error) {
    console.error('[Memory] Retrieval failed:', error);
    return []; // Return empty array so the main pipeline doesn't crash on DB memory failures
  }
}
