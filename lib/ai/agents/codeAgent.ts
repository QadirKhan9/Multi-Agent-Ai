import { AgentResponse, ChatMessage } from '../dispatcher';
import { AI_CONFIG } from '../config';
import { withFallback } from '../utils/withFallback';

interface CodeGenerationResult {
  explanation: string;
  code: string;
  language: string;
  execute: boolean;
}

const WANDBOX_COMPILER_NAMES: Record<string, string> = {
  python: "cpython-3.12.7",
  javascript: "nodejs-20.17.0",
  typescript: "typescript-5.6.2",
  java: "openjdk-jdk-22+36",
  cpp: "gcc-head",
  c: "gcc-head-c",
  go: "go-1.23.2",
  rust: "rust-1.82.0",
};

async function callGroqCodeGen(messages: any[]): Promise<string> {
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
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" }
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Groq Code Gen API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0]?.message?.content || '{}';
}

async function callGeminiCodeGen(messages: any[]): Promise<string> {
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
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Gemini Code Gen API error: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
}

async function generateCodeJSON(prompt: string, context: ChatMessage[], errorFeedback?: string): Promise<CodeGenerationResult> {
  let systemPrompt = `You are an expert, senior programmer. Output strictly valid JSON matching this schema:
{
  "explanation": "Briefly explain the code and what it does.",
  "code": "The raw code without markdown backticks.",
  "language": "lowercase language name (e.g. python, javascript, java, cpp)",
  "execute": true if the user explicitly wants to run, test, or execute the code, otherwise false
}`;

  if (errorFeedback) {
    systemPrompt += `\n\nTHE PREVIOUS CODE PRODUCED AN ERROR. FIX IT: \n${errorFeedback}`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.slice(-5).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: prompt }
  ];

  // Hardened withFallback for code generation model
  const rawContent = await withFallback(
    () => callGroqCodeGen(messages),
    () => callGeminiCodeGen(messages),
    'Code Agent LLM Model'
  );

  return JSON.parse(rawContent) as CodeGenerationResult;
}

async function executeCode(code: string, language: string): Promise<{ stdout: string; stderr: string; compile_output: string; message: string }> {
  const compiler = WANDBOX_COMPILER_NAMES[language.toLowerCase()];
  if (!compiler) {
    return { stdout: "", stderr: `Execution not supported for language: ${language}`, compile_output: "", message: "" };
  }

  const response = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      compiler,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Wandbox API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    stdout: data.program_output || "",
    stderr: data.program_error || "",
    compile_output: data.compiler_output || data.compiler_error || "",
    message: data.status === "0" ? "" : `Exit code: ${data.status}`,
  };
}

export async function runCodeAgent(query: string, context: ChatMessage[]): Promise<AgentResponse> {
  try {
    console.log(`[CodeAgent] Generating code for: "${query}"`);
    let result = await generateCodeJSON(query, context);

    let executionOutput = null;

    if (result.execute) {
      console.log(`[CodeAgent] Execution requested for language: ${result.language}`);
      try {
        const execRes = await executeCode(result.code, result.language);
        let errorDetails = execRes.stderr || execRes.compile_output || execRes.message;
        
        // Auto-fixing if there's an error
        if (errorDetails) {
          console.warn(`[CodeAgent] Code execution failed. Auto-fixing... Error: ${errorDetails.substring(0, 50)}...`);
          const fixPrompt = `The code you provided produced this error:\n${errorDetails}\n\nPlease fix the code and explain what was wrong.`;
          try {
            result = await generateCodeJSON(query, context, fixPrompt);
            const fixedExecRes = await executeCode(result.code, result.language);
            executionOutput = fixedExecRes.stdout || fixedExecRes.stderr || fixedExecRes.compile_output || fixedExecRes.message || "Executed successfully with no output.";
          } catch (fixError) {
            console.warn(`[CodeAgent] Auto-fix execution failed:`, fixError);
            executionOutput = `⚠️ Auto-fix failed to execute: ${(fixError as Error).message}`;
          }
        } else {
          executionOutput = execRes.stdout || "Executed successfully with no output.";
        }
      } catch (execError) {
        console.warn(`[CodeAgent] Execution failed:`, execError);
        executionOutput = `⚠️ Code execution service is currently unavailable: ${(execError as Error).message}`;
      }
    }

    const content = `${result.explanation}\n\n\`\`\`${result.language}\n${result.code}\n\`\`\``;

    return {
      agentType: "code_generation",
      content,
      executionOutput,
      status: "success",
    };
  } catch (error) {
    console.error(`[CodeAgent] Error:`, error);
    return {
      agentType: "code_generation",
      content: `⚠️ Failed to generate or execute code: ${(error as Error).message}`,
      status: "error",
    };
  }
}
