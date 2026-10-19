// AI Model Configuration
// Central place to manage model names and API endpoints

export const AI_CONFIG = {
  chat: {
    primary: {
      provider: 'groq' as const,
      model: 'openai/gpt-oss-120b',
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    },
    // Secondary Groq model used if the primary is unavailable/quota-limited
    secondary: {
      provider: 'groq' as const,
      model: 'openai/gpt-oss-20b',
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    },
    fallback: {
      provider: 'gemini' as const,
      // Use the stable non-aliased model ID
      model: 'gemini-2.0-flash',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    },
  },
  systemPrompt: `You are Synthox AI, a helpful, knowledgeable, and friendly AI assistant. You provide clear, accurate, and concise responses. When appropriate, you use markdown formatting to structure your responses for readability.`,
} as const;
