import { AgentResponse, ChatMessage } from '../dispatcher';
import { getChatResponse } from '../chatAgent';
import { withFallback } from '../utils/withFallback';

interface SearchSource {
  title: string;
  url: string;
}

export async function runSearchAgent(query: string, context: ChatMessage[]): Promise<AgentResponse> {
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  const serpApiKey = process.env.SERPAPI_API_KEY;
  let rawContent = "";
  let sources: SearchSource[] = [];
  let providerUsed = "tavily";
  let imageUrl: string | undefined = undefined;

  // SerpAPI images (parallel independent task)
  const serpPromise = serpApiKey ? (async () => {
    console.log(`[SearchAgent] Attempting SerpAPI images for: "${query}"`);
    const serpRes = await fetch(`https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&api_key=${serpApiKey}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!serpRes.ok) throw new Error(`SerpAPI returned ${serpRes.status}`);
    return await serpRes.json();
  })() : Promise.resolve(null);

  // Search Results fetch via withFallback
  const searchPromise = withFallback(
    async () => {
      if (!tavilyApiKey) throw new Error("TAVILY_API_KEY is not set");
      console.log(`[SearchAgent] Attempting Tavily search for: "${query}"`);
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query,
          search_depth: "basic",
          include_answer: false,
          include_images: true,
          max_results: 4,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Tavily API returned ${res.status}`);
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        throw new Error("No results from Tavily");
      }
      providerUsed = "tavily";
      return { type: 'tavily', data };
    },
    async () => {
      console.log(`[SearchAgent] Falling back to DuckDuckGo...`);
      const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`DDG API returned ${res.status}`);
      const data = await res.json();
      providerUsed = "duckduckgo";
      return { type: 'duckduckgo', data };
    },
    'Search Agent'
  );

  let searchResult;
  let serpResult;

  try {
    const results = await Promise.allSettled([searchPromise, serpPromise]);
    searchResult = results[0].status === 'fulfilled' ? results[0].value : null;
    serpResult = results[1].status === 'fulfilled' ? results[1].value : null;
  } catch (error) {
    console.error('[SearchAgent] Promise execution failed:', error);
  }

  // Parse SerpAPI results if available
  let serpImages: string[] = [];
  if (serpResult) {
    if (serpResult.images_results && serpResult.images_results.length > 0) {
      serpImages = serpResult.images_results.slice(0, 3).map((img: any) => img.original || img.thumbnail);
    }
  }

  // Parse Search Results
  if (searchResult) {
    if (searchResult.type === 'tavily') {
      const data = searchResult.data;
      rawContent = data.results.map((r: any) => `Source: ${r.title}\nURL: ${r.url}\nContent: ${r.content}\n`).join("\n");
      sources = data.results.map((r: any) => ({ title: r.title, url: r.url }));
      if (data.images && data.images.length > 0) {
        imageUrl = data.images[0];
      }
    } else if (searchResult.type === 'duckduckgo') {
      const data = searchResult.data;
      if (data.AbstractText) {
        rawContent = `Source: DuckDuckGo\nURL: ${data.AbstractURL}\nContent: ${data.AbstractText}`;
        sources = [{ title: data.Heading || "DuckDuckGo", url: data.AbstractURL }];
      } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        const validTopics = data.RelatedTopics.filter((t: any) => t.Text && t.FirstURL).slice(0, 3);
        if (validTopics.length > 0) {
          rawContent = validTopics.map((t: any) => `Source: DDG Topic\nURL: ${t.FirstURL}\nContent: ${t.Text}`).join("\n\n");
          sources = validTopics.map((t: any) => ({ title: "DuckDuckGo Related", url: t.FirstURL }));
        }
      }
    }
  }

  if (!rawContent) {
    return {
      agentType: "web_search",
      content: `⚠️ Failed to search the web for "${query}". Both search providers are currently unavailable.`,
      status: "error",
    };
  }

  // 3. Synthesize the results using the Chat Agent
  try {
    const imagesInstruction = serpImages.length > 0 
      ? serpImages.map((url, i) => `![Image ${i+1}](${url})`).join("\n") 
      : "No relevant images were found.";

    const synthesisPrompt = `Based on the following search results and images, answer the user's question.

Format your response EXACTLY like this:
# [Title]

## Summary
[A clear explanation generated from the search results]

## Key Facts
* [Fact 1]
* [Fact 2]
* [Fact 3]

## Images
${imagesInstruction}

## Sources
[List the source URLs]

---

User Question: ${query}

Search Results:
${rawContent}

Rules:
* Never invent facts.
* Always cite sources.
* Keep responses concise, accurate, and well-structured.`;

    const chatContext = [...context, { role: 'user' as const, content: synthesisPrompt }];
    const chatRes = await getChatResponse(chatContext);

    console.log(`[SearchAgent] Search complete. Provider: ${providerUsed}`);

    return {
      agentType: "web_search",
      content: chatRes.content,
      sources: JSON.stringify(sources),
      status: "success",
      imageUrl: imageUrl,
    };
  } catch (synthError) {
    console.error(`[SearchAgent] Synthesis failed:`, synthError);
    return {
      agentType: "web_search",
      content: `⚠️ Retrieved search results but failed to synthesize them: ${(synthError as Error).message}`,
      status: "error",
    };
  }
}
