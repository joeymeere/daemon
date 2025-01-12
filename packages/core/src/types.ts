import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types";
import type { Keypair } from "@solana/web3.js";
import { z } from "zod";

export const ZModelSettings = z.object({
  provider: z.string(), // OpenAI, Anthropic, etc.
  name: z.string(), // gpt-4o, claude-3-5-sonnet, etc.
  temperature: z.number(),
  maxTokens: z.number(),
  endpoint: z.string(),
});

export type ModelSettings = z.infer<typeof ZModelSettings>;

export const ZCharacter = z.object({
  name: z.string(),
  pubkey: z.string(),
  // Model Settings
  modelSettings: z.object({
    generation: ZModelSettings,
    // Used to embed the message into a vector space
    embedding: ZModelSettings.optional(), // use generation if not set
  }),
  bio: z.array(z.string()).optional(),
  lore: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
});

export type Character = z.infer<typeof ZCharacter>;

const ZMemory = z.object({
  id: z.string(),
  daemonId: z.string(),
  channelId: z.string().nullable(),
  createdAt: z.date(),
  content: z.string(),
  embedding: z.array(z.number()),
  originationLogIds: z.array(z.string()),
});

export type IMemory = z.infer<typeof ZMemory>;

const ZLog = z.object({
  id: z.string().optional(),
  daemonId: z.string(),
  channelId: z.string().nullable(),
  createdAt: z.date().optional(),
  content: z.string(),
  logType: z.enum(["input", "output"]),
});

export type ILog = z.infer<typeof ZLog>;

const ZApproval = z.object({
  signature: z.string(), //b64 signature of the hash
});

export type IApproval = z.infer<typeof ZApproval>;

const ZTool = z.object({
  name: z.string(),
  description: z.string(),
  type: z.enum(["Context", "Action", "PostProcess", "Server"]),
  inputParameters: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      type: z.enum(["string", "number", "boolean", "array", "object"]),
    })
  ),
});

export type ITool = z.infer<typeof ZTool>;

export interface IDaemonMCPServer {
  // Server Info
  getServerInfo(): Promise<{
    name: string;
    description: string;
  }>;
  // List Tools
  listServerTools(): Promise<ITool[]>;
  listContextTools(): Promise<ITool[]>;
  listActionTools(): Promise<ITool[]>;
  listPostProcessTools(): Promise<ITool[]>;
}

export interface IIdentityServer extends IDaemonMCPServer {
  // Server Tools
  registerCharacter(character: Character): Promise<string>; // returns characterId
  fetchCharacter(characterId: string): Promise<Character | undefined>;
  fetchLogs(opts: {
    daemonId: string;
    channelId?: string;
    limit?: number; // Default 100
    orderBy?: "asc" | "desc"; // Default desc
  }): Promise<ILog[]>;
  // Context Tools
  fetchMemoryContext(opts: {
    daemonId: string;
    messageEmbedding: number[];
    limit: number; // Default 10
    channelId?: string; // Will include Common Memories and Channel Memories
  }): Promise<IMemory[]>;
  // Action Tools
  // Post Process Tools
  createLog(log: ILog, approval: IApproval): Promise<void>;
  createMemory(
    opts: {
      daemonId: string;
      message: string;
      messageEmbedding: number[];
      channelId?: string; // Will include Common Memories and Channel Memories
    },
    approval: IApproval
  ): Promise<string>; // Returns memoryId
}

export interface ToolRegistration {
  serverUrl: string;
  tool: ITool;
}

export const ZMessageLifecycle = z.object({
  message: z.string(),
  systemPrompt: z.string().optional(),
  embedding: z.array(z.number()).optional(),
  context: z.array(z.string()).optional(),
  output: z.string().optional(),
  actions: z.array(z.string()).optional(),
  postProcess: z.array(z.string()).optional(),
});

export type IMessageLifecycle = z.infer<typeof ZMessageLifecycle>;

export interface IDaemon {
  // Properties
  id: string | undefined;
  character: Character | undefined;
  keypair: Keypair | undefined;
  mcpClients: {
    [url: string]: {
      name: string;
      description: string;
      client: Client;
    };
  };
  tools: {
    server: ToolRegistration[];
    context: ToolRegistration[];
    action: ToolRegistration[];
    postProcess: ToolRegistration[];
  };
  modelApiKeys: {
    generationKey: string | undefined;
    embeddingKey: string | undefined;
  };

  // Methods
  init(opts: {
    id?: string;
    character?: Character;
    privateKey: Keypair;
    modelApiKeys: {
      generationKey: string;
      embeddingKey?: string;
    };
  }): Promise<void>;

  addMCPServer(opts: { url: string }): Promise<void>;
  removeMCPServer(opts: { url: string }): Promise<void>;

  message(
    message: string,
    opts?: {
      channelId?: string;
      context?: boolean;
      actions?: boolean;
      postProcess?: boolean;
    }
  ): Promise<IMessageLifecycle>;
}
