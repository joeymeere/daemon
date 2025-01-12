import OpenAI from "openai";
import type { IMessageLifecycle, ModelSettings } from "./types";
import Anthropic from "@anthropic-ai/sdk";

export async function generateEmbeddings(
  embeddingModelSettings: ModelSettings,
  embeddingModelKey: string,
  message: string
): Promise<number[]> {
  switch (embeddingModelSettings?.provider) {
    case "openai":
      const client = new OpenAI({
        apiKey: embeddingModelKey,
        baseURL: embeddingModelSettings.endpoint,
      });

      const embedding = await client.embeddings.create({
        model: embeddingModelSettings.name,
        input: message,
      });
      return embedding.data[0].embedding;
      break;
    case "anthropic":
      throw new Error("Anthropic embedding not implemented");
      break;
  }
}

export async function generateText(
  generationModelSettings: ModelSettings,
  generationModelKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  switch (generationModelSettings?.provider) {
    case "openai":
      const openai = new OpenAI({
        apiKey: generationModelKey,
        baseURL: generationModelSettings.endpoint,
      });

      const openaiResponse = await openai.chat.completions.create({
        model: generationModelSettings.name,
        messages: [
          {
            role: "system",
            content: `
            You are a growing and adapting AI agent.
            You are able to learn from your experiences and adapt your behavior to new situations. 
            You are able to take in new input and make new memories and use those memories to make decisions.
            `,
          },
          {
            role: "user",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: generationModelSettings.temperature,
        max_completion_tokens: generationModelSettings.maxTokens,
      });

      return openaiResponse.choices[0].message.content ?? "";
      break;
    case "anthropic":
      const anthropic = new Anthropic({
        apiKey: generationModelKey,
        baseURL: generationModelSettings.endpoint,
      });

      const anthropicResponse = await anthropic.messages.create({
        model: generationModelSettings.name,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
        max_tokens: generationModelSettings.maxTokens ?? 1000,
        temperature: generationModelSettings.temperature ?? 0.2,
      });

      return anthropicResponse.content.join("\n");
      break;
  }
}

export function createPrompt(lifecycle: IMessageLifecycle): string {
  return `
  # Message
  ${lifecycle.message}
  
  # Context
  ${lifecycle.context?.join("\n")}
  `;
}
