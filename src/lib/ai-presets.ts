// Shared between server and client (no secrets here).
export type AiPreset = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  models: string[];
  free: boolean;
  keyUrl: string;
  note: string;
};

export const AI_PRESETS: AiPreset[] = [
  {
    id: "groq",
    name: "Groq (free tier)",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    free: true,
    keyUrl: "https://console.groq.com/keys",
    note: "Very fast and free with rate limits. Recommended default.",
  },
  {
    id: "gemini",
    name: "Google Gemini (free tier)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
    free: true,
    keyUrl: "https://aistudio.google.com/apikey",
    note: "Generous free tier via Google AI Studio.",
  },
  {
    id: "openrouter",
    name: "OpenRouter (free models)",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    models: ["meta-llama/llama-3.3-70b-instruct:free", "deepseek/deepseek-chat-v3-0324:free"],
    free: true,
    keyUrl: "https://openrouter.ai/keys",
    note: "Many models; ':free' variants cost nothing (rate limited).",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
    free: false,
    keyUrl: "https://platform.openai.com/api-keys",
    note: "Paid.",
  },
  {
    id: "ollama",
    name: "Ollama (local, free)",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
    models: ["llama3.1", "qwen2.5", "mistral"],
    free: true,
    keyUrl: "https://ollama.com",
    note: "Runs on your own machine. API key can be anything.",
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    baseUrl: "",
    model: "",
    models: [],
    free: false,
    keyUrl: "",
    note: "Any API that speaks the OpenAI chat-completions format.",
  },
];
