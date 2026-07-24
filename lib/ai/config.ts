// AI Model Configuration
// Central place to manage model names and API endpoints

export const AI_CONFIG = {
  chat: {
    primary: {
      provider: 'groq' as const,
      model: 'llama-3.3-70b-versatile',
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    },
    fallback: {
      provider: 'gemini' as const,
      model: 'gemini-flash-latest',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    },
  },
  systemPrompt: `You are Synthox AI, a helpful, knowledgeable, and friendly AI assistant. You provide clear, accurate, and concise responses. When appropriate, you use markdown formatting to structure your responses for readability.`,
} as const;
