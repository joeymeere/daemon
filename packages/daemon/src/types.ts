import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Keypair } from "@solana/web3.js";
import { z } from "zod";

export const ZMessageLifecycle = z.object({
  daemonPubkey: z.string(),
  message: z.string(),
  messageId: z.string(),
  createdAt: z.string(),
  approval: z.string(),
  channelId: z.string().nullable(),
  daemonName: z.string().default(""),
  identityPrompt: z.string().nullable(),
  embedding: z.array(z.number()).default([]),
  context: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  generatedPrompt: z.string().default(""),
  output: z.string().default(""),
  actions: z.array(z.string()).default([]),
  postProcess: z.array(z.string()).default([]),
});

export type IMessageLifecycle = z.infer<typeof ZMessageLifecycle>;

export const ZModelSettings = z.object({
  provider: z.enum(["openai", "anthropic"]),
  endpoint: z.string(),
  name: z.string(), // gpt-4o, claude-3-5-sonnet, etc.
  apiKey: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  dimensions: z.number().optional(),
});

export type ModelSettings = z.infer<typeof ZModelSettings>;

export const ZCharacter = z.object({
  name: z.string(),
  pubkey: z.string(),
  // Model Settings
  modelSettings: z.object({
    generation: ZModelSettings,
    // Used to embed the message into a vector space
    embedding: ZModelSettings, // use generation if not set
  }),
  identityPrompt: z.string(),
  identityServerUrl: z.string(),
  bootstrap: z.array(
    z.object({
      serverUrl: z.string(),
      tools: z.array(
        z.object({
          toolName: z.string(),
          args: z.any(),
        })
      ),
    })
  ),
});

export type Character = z.infer<typeof ZCharacter>;

const ZApproval = z.object({
  signature: z.string(), //b64 signature of the hash
});

export type IApproval = z.infer<typeof ZApproval>;

const ZTool = z.object({
  name: z.string(),
  description: z.string(),
  type: z.enum(["Context", "Action", "PostProcess", "Server"]),
  zIndex: z.number(),
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

// IDENTITY SERVER STUFF
const ZLog = z.object({
  id: z.string().optional(),
  daemonPubkey: z.string(),
  channelId: z.string().nullable(),
  createdAt: z.date().optional(),
  lifecycle: ZMessageLifecycle,
});

export type ILog = z.infer<typeof ZLog>;

export interface IIdentityServer extends IDaemonMCPServer {
  // Server Tools
  registerCharacter(character: Character): Promise<{ pubkey: string }>; // returns characterId
  fetchCharacter(pubkey: string): Promise<Character | undefined>;
  fetchLogs(opts: {
    daemonPubkey: string;
    channelId?: string;
    limit?: number; // Default 100
    orderBy?: "asc" | "desc"; // Default desc
  }): Promise<ILog[]>;
  // Context Tools
  // Action Tools
  // Post Process Tools
  pp_createLog(lifecycle: IMessageLifecycle): Promise<IMessageLifecycle>;
}

export interface ToolRegistration {
  serverUrl: string;
  tool: ITool;
}

export interface IDaemon {
  // Properties
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
  init(
    identityServerUrl: string,
    opts: {
      character?: Character;
      privateKey: Keypair;
      modelApiKeys: {
        generationKey: string;
        embeddingKey?: string;
      };
    }
  ): Promise<void>;

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
