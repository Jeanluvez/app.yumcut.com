import OpenAI from 'openai';

let cachedClient: OpenAI | null = null;

export function getOpenAIClient() {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseURL = process.env.OPENAI_BASE_URL?.trim();

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  cachedClient = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  return cachedClient;
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-nano';
}
