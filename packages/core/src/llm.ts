import OpenAI from "openai";
import type { IDaemon, IMessageLifecycle } from "./types";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_SYSTEM_PROMPT = (daemon: IDaemon) => {
  return `
  You are ${daemon.character?.name}. Keep your responses concise and to the point.
  `;
};

export async function generateEmbeddings(
  daemon: IDaemon,
  lifecycle: IMessageLifecycle
): Promise<IMessageLifecycle> {
  const embeddingModelSettings = daemon.character?.modelSettings.embedding;
  const embeddingModelKey = daemon.modelApiKeys.embeddingKey;

  switch (embeddingModelSettings?.provider) {
    case "openai":
      const client = new OpenAI({
        apiKey: embeddingModelKey,
        baseURL: embeddingModelSettings.endpoint,
      });

      const embedding = await client.embeddings.create({
        model: embeddingModelSettings.name,
        input: lifecycle.message,
      });
      lifecycle.embedding = embedding.data[0].embedding;
      break;
    case "anthropic":
      throw new Error("Anthropic embedding not implemented");
      break;
  }

  return lifecycle;
}

export async function generateText(
  daemon: IDaemon,
  lifecycle: IMessageLifecycle
): Promise<IMessageLifecycle> {
  const generationModelSettings = daemon.character?.modelSettings.generation;
  const generationModelKey = daemon.modelApiKeys.generationKey;

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
            content: lifecycle.systemPrompt ?? DEFAULT_SYSTEM_PROMPT(daemon),
          },
          {
            role: "user",
            content: createPrompt(lifecycle),
          },
        ],
        temperature: generationModelSettings.temperature,
        max_completion_tokens: generationModelSettings.maxTokens,
      });

      lifecycle.output = openaiResponse.choices[0].message.content ?? undefined;
      break;
    case "anthropic":
      const anthropic = new Anthropic({
        apiKey: generationModelKey,
        baseURL: generationModelSettings.endpoint,
      });

      const anthropicResponse = await anthropic.messages.create({
        model: generationModelSettings.name,
        system: lifecycle.systemPrompt ?? DEFAULT_SYSTEM_PROMPT(daemon),
        messages: [
          {
            role: "user",
            content: createPrompt(lifecycle),
          },
        ],
        max_tokens: generationModelSettings.maxTokens ?? 1000,
        temperature: generationModelSettings.temperature ?? 0.2,
      });

      lifecycle.output = anthropicResponse.content.join("\n");
      break;
  }

  return lifecycle;
}

function createPrompt(lifecycle: IMessageLifecycle): string {
  return `
  # Message
  ${lifecycle.message}
  
  # Context
  ${lifecycle.context?.join("\n")}
  `;
}
