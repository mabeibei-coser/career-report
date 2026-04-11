import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL,
});

export const MINIMAX_MODEL = process.env.MINIMAX_MODEL || "MiniMax-M1";

export default client;
