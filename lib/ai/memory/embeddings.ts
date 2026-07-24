export async function generateEmbedding(text: string): Promise<number[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  let providerUsed = 'gemini';

  // 1. Primary: Gemini API
  if (geminiKey) {
    try {
      console.log(`[Embeddings] Generating embedding via Gemini for: "${text.substring(0, 30)}..."`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [{ text }],
          },
          outputDimensionality: 768,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        const embedding = data.embedding?.values;
        if (Array.isArray(embedding) && embedding.length === 768) {
          return embedding;
        }
        throw new Error('Gemini response format invalid or incorrect dimension');
      } else {
        throw new Error(`Gemini returned HTTP ${response.status}`);
      }
    } catch (geminiError) {
      console.warn(`[Embeddings] Gemini failed (${(geminiError as Error).message}). Trying Hugging Face fallback...`);
    }
  }

  // 2. Fallback: Hugging Face API
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) {
    throw new Error('Hugging Face fallback key (HUGGINGFACE_API_KEY) not set, and Gemini failed.');
  }

  try {
    console.log(`[Embeddings] Generating embedding via Hugging Face fallback for: "${text.substring(0, 30)}..."`);
    const hfUrl = 'https://api-inference.huggingface.co/models/sentence-transformers/all-mpnet-base-v2';
    const response = await fetch(hfUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Hugging Face returned HTTP ${response.status}`);
    }

    let embedding = await response.json();
    if (Array.isArray(embedding)) {
      if (Array.isArray(embedding[0])) {
        embedding = embedding[0];
      }
      if (embedding.length === 768) {
        return embedding;
      }
    }
    throw new Error('Hugging Face response invalid or incorrect dimension');
  } catch (hfError) {
    console.error('[Embeddings] Both Gemini and Hugging Face failed to embed.');
    throw hfError;
  }
}
