import { AI_CONFIG } from './config';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface RouterDecision {
  steps: {
    intent: 'chat' | 'image_generation' | 'pdf_generation' | 'code_generation' | 'web_search' | 'voice_generation';
    reasoning: string;
    extractedQuery: string;
  }[];
}

const ROUTER_SYSTEM_PROMPT = `
You are an intelligent Intent Router for Synthox AI. Your job is to analyze the user's latest message and determine which specialized AI agents are required to fulfill the request.

CRITICAL RULE FOR WEB SEARCH:
The "web_search" intent MUST remain inactive by default. Only route to "web_search" when the user's message EXPLICITLY asks to search the web, search the internet, look up online, or get the latest live news/updates.

Do NOT route to "web_search" for questions asking "who is...", "what is...", "explain...", "tell me about...", "define...", or general questions, even if they refer to real-world entities. These must be handled by the "chat" intent using internal knowledge.

Examples that MUST route to "web_search":
- "search about NASA"
- "search for Elon Musk"
- "search the web for AI news"
- "search on the internet"
- "look up NASA"
- "find information online"
- "search latest news"
- "latest updates about Tesla"

Examples that MUST route to "chat" (NOT "web_search"):
- "tell me about NASA"
- "who is Elon Musk"
- "explain gravity"
- "what is Python"
- "define machine learning"

CRITICAL RULE FOR CODE GENERATION:
Route to "code_generation" whenever the user asks to write, generate, create, build, run, execute, fix, debug, review, or explain code in ANY programming language.

Examples that MUST route to "code_generation":
- "Write a Python script to reverse a string"
- "Write a Python script to make a string uppercase and run it"
- "Create a JavaScript function to sort an array"
- "Run this Python code"
- "Execute this script"
- "Fix the bug in my code"
- "Debug this function"
- "Write a script in Java to print Hello World"
- "Generate code to fetch data from an API"
- "Code a solution for the fibonacci sequence"

Available Intents:
- "chat": General conversation, greetings, conceptual explanations, or answering questions based on internal knowledge.
- "image_generation": The user explicitly wants a picture, artwork, or image generated.
- "pdf_generation": The user wants to create, generate, or export a PDF document.
- "code_generation": The user wants to write, generate, run, execute, debug, fix, review, or explain code in any programming language.
- "web_search": The user explicitly requests a web or internet search.
- "voice_generation": The user wants text converted to speech or audio.

Instructions:
1. Analyze the request. It may contain multiple intents (e.g., "search the web for X and then generate an image of it").
2. CRITICAL RULE FOR SINGLE TASKS: When a user asks specifically to generate an image, write code, create a PDF, search the web, or synthesize voice, output ONLY that specific single specialized intent in the "steps" array. Do NOT add a redundant "chat" step alongside it unless the user explicitly requested a separate conversation response.
3. CRITICAL RULE FOR CHAT INTENT: Never output multiple "chat" steps in the "steps" array. All greetings, questions, and conversational text in a single user message MUST be merged into a SINGLE "chat" step (e.g. "hello who is srk" must result in ONLY ONE "chat" step with extractedQuery: "hello who is srk").
4. Return a JSON object with a "steps" array. Each step should be an object with:
   - "intent": One of the exact strings listed above.
   - "reasoning": A brief explanation of why this intent was chosen.
   - "extractedQuery": A cleaned up, actionable version of the user's request specific to this step.
5. If no specific specialized intent matches, default to "chat".
6. Output strictly valid JSON matching the required schema. Do not include markdown formatting like \`\`\`json.
`;

export async function routeIntent(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<RouterDecision> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const messages = [
    { role: 'system', content: ROUTER_SYSTEM_PROMPT },
    // Only pass the last 5 messages for routing context to keep it fast
    ...conversationHistory.slice(-5).map(m => ({
      role: m.role,
      content: m.content
    })),
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await fetch(AI_CONFIG.chat.primary.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_CONFIG.chat.primary.model,
        messages,
        temperature: 0.1, // Low temperature for deterministic classification
        max_tokens: 1024,
        response_format: { type: "json_object" }
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      throw new Error(`Groq Routing API error (${response.status})`);
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || '{}';
    
    // Parse the JSON. If it fails or is invalid, fallback to a default 'chat' decision
    const parsed = JSON.parse(rawContent) as RouterDecision;
    
    if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error("Invalid router schema returned");
    }

    return parsed;
  } catch (error) {
    console.error('[RouterAgent] Groq Routing failed, falling back to Gemini:', (error as Error).message);
    
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not set');

      const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`;

      const geminiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          contents,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: "application/json"
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!geminiResponse.ok) {
        throw new Error(`Gemini API error (${geminiResponse.status})`);
      }

      const geminiData = await geminiResponse.json();
      const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      const parsed = JSON.parse(rawContent) as RouterDecision;
      if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
        throw new Error("Invalid router schema returned by Gemini");
      }
      return parsed;
    } catch (geminiError) {
      console.error('[RouterAgent] Gemini fallback also failed, forcing basic chat:', (geminiError as Error).message);
      // Safe fallback if BOTH LLMs fail or timeout
      return {
        steps: [
          {
            intent: 'chat',
            reasoning: 'Fallback due to dual API failures',
            extractedQuery: userMessage
          }
        ]
      };
    }
  }
}
