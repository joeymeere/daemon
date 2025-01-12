import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
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
  bio: z.array(z.string()),
  lore: z.array(z.string()),
  systemPrompt: z.string().optional(),
  pubkey: z.string(),
  // Model Settings
  modelSettings: z.object({
    generation: ZModelSettings,
    // Used to decide what tools to use to build context for Generation
    decision: ZModelSettings.optional(), // use generation if not set
    // Used to embed the message into a vector space
    embedding: ZModelSettings.optional(), // use generation if not set
  }),
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

export type Tool = z.infer<typeof ZTool>;

export interface IDaemonMCPServer {
  // Server Info
  getServerInfo(): Promise<{
    name: string;
    description: string;
  }>;
  // List Tools
  listServerTools(): Promise<Tool[]>;
  listContextTools(): Promise<Tool[]>;
  listActionTools(): Promise<Tool[]>;
  listPostProcessTools(): Promise<Tool[]>;
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
  tool: Tool;
}

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

  // Methods
  init(opts: {
    id?: string;
    character?: Character;
    privateKey: Keypair;
  }): Promise<void>;

  addMCPServer(opts: { url: string }): Promise<void>;
  /*   message(
    message: string,
    opts?: { stateless?: boolean; channelId?: string }
  ): Promise<void>; */
}
