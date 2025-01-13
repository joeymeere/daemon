import { LiteMCP } from "litemcp";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as TYPES from "./types";
import { eq, desc, asc, and, cosineDistance, gte } from "drizzle-orm";
import { pgTable, timestamp } from "drizzle-orm/pg-core";
import { jsonb, text, vector } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { decodeUTF8 } from "tweetnacl-util";
import { generateText, generateEmbeddings } from "./llm";

/**
 * Context Server manages
 *  - Character Files
 *  - Common Memories
 *  - Channel Memories
 *  - Channel Conversation Logs
 */
export class IdentityServerPostgres implements TYPES.IIdentityServer {
  private db: NodePgDatabase<typeof ContextServerSchema>;
  private server: LiteMCP;

  private modelInfo: {
    embedding: TYPES.ModelSettings;
    generation: TYPES.ModelSettings;
  };

  private initialized: boolean = false;

  constructor(
    pgOpts: PoolConfig,
    modelInfo: typeof this.modelInfo,
    serverOpts?: { name?: string }
  ) {
    this.db = drizzle(new Pool(pgOpts), {
      schema: ContextServerSchema,
      casing: "snake_case",
    });

    this.modelInfo = modelInfo;
    this.server = new LiteMCP(serverOpts?.name || "context-server", "1.0.0");
  }

  async init(): Promise<void> {
    // Enable pgvector extension
    await this.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

    await this.db.execute(
      sql`CREATE TABLE IF NOT EXISTS daemons (id text PRIMARY KEY, character jsonb, pubkey text NOT NULL)`
    );
    console.log("Created daemons table");

    // Memories
    await this.db.execute(
      sql`CREATE TABLE IF NOT EXISTS memories (id text PRIMARY KEY, daemon_id text NOT NULL, channel_id text, created_at timestamp NOT NULL, content text NOT NULL, embedding vector(${sql.raw(
        this.modelInfo.embedding.dimensions?.toString() || "1536"
      )}) NOT NULL, original_lifecycle jsonb)`
    );
    console.log("Created memories table");

    await this.db.execute(
      sql`CREATE INDEX IF NOT EXISTS "embeddingIndex" ON "memories" USING hnsw (embedding vector_cosine_ops)`
    );
    console.log("Created embeddingIndex");

    // Logs
    await this.db.execute(
      sql`CREATE TABLE IF NOT EXISTS logs (id text PRIMARY KEY, daemon_id text NOT NULL, channel_id text, created_at timestamp NOT NULL, lifecycle jsonb)`
    );
    console.log("Created logs table");

    this.initialized = true;
  }

  async start(port?: number): Promise<void> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    // Server Info
    this.server.addTool({
      name: "getServerInfo",
      description: "Get server info",
      parameters: z.object({}),
      execute: async () => {
        return await this.getServerInfo();
      },
    });

    // List Tools
    this.server.addTool({
      name: "listServerTools",
      description: "List server tools",
      parameters: z.object({}),
      execute: async () => {
        return await this.listServerTools();
      },
    });

    this.server.addTool({
      name: "listContextTools",
      description: "List context tools",
      parameters: z.object({}),
      execute: async () => {
        return await this.listContextTools();
      },
    });

    this.server.addTool({
      name: "listActionTools",
      description: "List action tools",
      parameters: z.object({}),
      execute: async () => {
        return await this.listActionTools();
      },
    });

    this.server.addTool({
      name: "listPostProcessTools",
      description: "List post process tools",
      parameters: z.object({}),
      execute: async () => {
        return await this.listPostProcessTools();
      },
    });

    // Server Tools
    this.server.addTool({
      name: "registerCharacter",
      description: "Register a new character",
      parameters: TYPES.ZCharacter,
      execute: async (character: TYPES.Character) => {
        return JSON.stringify(await this.registerCharacter(character));
      },
    });

    this.server.addTool({
      name: "fetchCharacter",
      description: "Fetch a character",
      parameters: z.object({
        daemonId: z.string(),
      }),
      execute: async (args: { daemonId: string }) => {
        return JSON.stringify((await this.fetchCharacter(args.daemonId)) || {});
      },
    });

    this.server.addTool({
      name: "fetchLogs",
      description: "Fetch logs",
      parameters: z.object({
        daemonId: z.string(),
        channelId: z.string().optional(),
        limit: z.number().optional(),
        orderBy: z.enum(["asc", "desc"]).optional(),
      }),
      execute: async (args) => {
        return JSON.stringify(await this.fetchLogs(args));
      },
    });

    this.server.addTool({
      name: "ctx_fetchMemoryContext",
      description: "Fetch memory context",
      parameters: z.object({
        lifecycle: TYPES.ZMessageLifecycle,
        args: z.any().optional(),
      }),
      execute: async (args: {
        lifecycle: TYPES.IMessageLifecycle;
        args?: any;
      }) => {
        return JSON.stringify(
          await this.ctx_fetchMemoryContext(args.lifecycle)
        );
      },
    });

    // Action Tools
    // Post Process Tools
    this.server.addTool({
      name: "pp_createMemory",
      description: "Create a memory",
      parameters: z.object({
        lifecycle: TYPES.ZMessageLifecycle,
        args: z.any().optional(),
      }),
      execute: async (args: {
        lifecycle: TYPES.IMessageLifecycle;
        args?: any;
      }) => {
        return JSON.stringify(await this.pp_createMemory(args.lifecycle));
      },
    });

    this.server.addTool({
      name: "pp_createLog",
      description: "Insert a log",
      parameters: z.object({
        lifecycle: TYPES.ZMessageLifecycle,
        args: z.any().optional(),
      }),
      execute: async (args: {
        lifecycle: TYPES.IMessageLifecycle;
        args?: any;
      }) => {
        return JSON.stringify(await this.pp_createLog(args.lifecycle));
      },
    });

    // Start the Server
    this.server.start({
      transportType: "sse",
      sse: {
        endpoint: `/sse`,
        port: port || 8080,
      },
    });
  }

  async stop(): Promise<void> {
    // TODO: Placeholder to do things here;
  }

  // Server Info
  async getServerInfo(): Promise<{ name: string; description: string }> {
    return {
      name: "Daemon Identity Server",
      description:
        "Identity Server for Daemon Framework that manages characters and memories",
    };
  }

  // List Tools
  async listServerTools(): Promise<TYPES.ITool[]> {
    return [
      {
        name: "registerCharacter",
        description: "Register a new character",
        type: "Server",
        zIndex: 0,
      },
      {
        name: "fetchCharacter",
        description: "Fetch a character",
        type: "Server",
        zIndex: 0,
      },
      {
        name: "fetchLogs",
        description: "Fetch logs",
        type: "Server",
        zIndex: 0,
      },
    ];
  }

  async listContextTools(): Promise<TYPES.ITool[]> {
    return [
      {
        name: "ctx_fetchMemoryContext",
        description: "Fetch memory context",
        type: "Context",
        zIndex: 0,
      },
    ];
  }

  async listActionTools(): Promise<TYPES.ITool[]> {
    return [];
  }

  async listPostProcessTools(): Promise<TYPES.ITool[]> {
    return [
      {
        name: "pp_createLog",
        description: "Create a log",
        type: "PostProcess",
        zIndex: 99999,
      },
      {
        name: "pp_createMemory",
        description: "Create a memory",
        type: "PostProcess",
        zIndex: 0,
      },
    ];
  }

  // Server Tools
  async registerCharacter(
    character: TYPES.Character
  ): Promise<{ daemonId: string }> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    const daemonId = nanoid();
    await this.db.insert(ContextServerSchema.daemons).values({
      id: daemonId,
      character,
      pubkey: character.pubkey,
    });

    if (character.lore) {
      // Create memories from lore
      const systemPrompt = `
      You are a helpful assistant that will take the following lore about an AI agent and create a memory for the AI agent to store and retrieve later.
      Keep memories less than 256 characters.
      `;
      let lorePromises: Promise<{
        memoryId: string;
        summary: string;
        embedding: number[];
      }>[] = [];
      for (const lore of character.lore) {
        lorePromises.push(
          this.createMemoryAndEmbeddings(
            daemonId,
            systemPrompt,
            lore,
            null,
            undefined
          )
        );
      }
      await Promise.all(lorePromises);
    }
    return { daemonId };
  }

  async fetchCharacter(daemonId: string): Promise<TYPES.Character | undefined> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    const character = await this.db
      .select()
      .from(ContextServerSchema.daemons)
      .where(eq(ContextServerSchema.daemons.id, daemonId))
      .execute();
    return character[0]?.character as TYPES.Character | undefined;
  }

  async fetchLogs(opts: {
    daemonId: string;
    channelId?: string;
    limit?: number;
    orderBy?: "asc" | "desc";
  }): Promise<TYPES.ILog[]> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    const logs = await this.db
      .select()
      .from(ContextServerSchema.logs)
      .where(eq(ContextServerSchema.logs.daemonId, opts.daemonId))
      .limit(opts.limit || 100)
      .orderBy(
        opts.orderBy === "asc"
          ? asc(ContextServerSchema.logs.createdAt)
          : desc(ContextServerSchema.logs.createdAt)
      )
      .execute();

    return logs.map((log) => {
      return {
        ...log,
        lifecycle: log.lifecycle as TYPES.IMessageLifecycle,
      };
    });
  }

  // Context Tools
  async ctx_fetchMemoryContext(
    lifecycle: TYPES.IMessageLifecycle
  ): Promise<TYPES.IMessageLifecycle> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    if (!lifecycle.embedding) {
      throw new Error("Requires embeddings for the message");
    }
    const similarityThreshold = 0.85; // TODO: Make this configurable
    const limit = 10; // TODO: Make this configurable
    const similarity = sql<number>`1 - (${cosineDistance(
      ContextServerSchema.memories.embedding,
      lifecycle.embedding
    )})`;

    const relevantMemories = await this.db
      .select()
      .from(ContextServerSchema.memories)
      .where(
        and(
          eq(ContextServerSchema.memories.daemonId, lifecycle.daemonId),
          lifecycle.channelId
            ? eq(ContextServerSchema.memories.channelId, lifecycle.channelId)
            : undefined,
          gte(similarity, similarityThreshold)
        )
      )
      .orderBy(desc(similarity))
      .limit(limit)
      .execute();

    lifecycle.context.push(...relevantMemories.map((memory) => memory.content));
    return lifecycle;
  }

  // Action Tools

  // Post Process Tools
  async pp_createLog(
    lifecycle: TYPES.IMessageLifecycle
  ): Promise<TYPES.IMessageLifecycle> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    // Check Approval
    // Fetch Daemon Pubkey
    const daemon = await this.db
      .select({
        pubkey: ContextServerSchema.daemons.pubkey,
      })
      .from(ContextServerSchema.daemons)
      .where(eq(ContextServerSchema.daemons.id, lifecycle.daemonId))
      .execute();
    const daemonPubkey = daemon[0]?.pubkey;

    if (!checkApproval(daemonPubkey, lifecycle)) {
      throw new Error("Approval failed");
    }

    // Create Log
    const logId = nanoid();
    await this.db.insert(ContextServerSchema.logs).values({
      id: logId,
      daemonId: lifecycle.daemonId,
      channelId: lifecycle.channelId,
      createdAt: new Date(),
      lifecycle: lifecycle,
    });

    lifecycle.postProcess.push(
      JSON.stringify({
        server: this.server.name,
        tool: "pp_createLog",
        args: {
          logId,
        },
      })
    );
    return lifecycle;
  }

  async pp_createMemory(
    lifecycle: TYPES.IMessageLifecycle
  ): Promise<TYPES.IMessageLifecycle> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    // Check Approval
    // Fetch Daemon Pubkey
    const daemon = await this.db
      .select({
        pubkey: ContextServerSchema.daemons.pubkey,
      })
      .from(ContextServerSchema.daemons)
      .where(eq(ContextServerSchema.daemons.id, lifecycle.daemonId))
      .execute();
    const daemonPubkey = daemon[0]?.pubkey;

    if (!checkApproval(daemonPubkey, lifecycle)) {
      throw new Error("Approval failed");
    }

    // TODO:
    // Decide if memory should be created (current ALL messages are stored) ->
    // Generate Summary & Embedding for Memory ->
    const systemPrompt = `You are a helpful assistant that can concisely summarize a conversation into a one sentence summary to be stored as a memory for an AI agent.`;
    const summaryPrompt = `
    Summarize the following input message and what the AI agent replied with as a memory that's less than 256 characters.
    # Input Message
    ${lifecycle.message}
    # Agent Reply
    ${lifecycle.output} 
    `;

    const { memoryId, summary, embedding } =
      await this.createMemoryAndEmbeddings(
        lifecycle.daemonId,
        systemPrompt,
        summaryPrompt,
        lifecycle.channelId,
        lifecycle
      );

    lifecycle.postProcess.push(
      JSON.stringify({
        server: this.server.name,
        tool: "pp_createMemory",
        args: {
          memoryId,
        },
      })
    );
    return lifecycle;
  }

  private async createMemoryAndEmbeddings(
    daemonId: string,
    systemPrompt: string,
    summaryPrompt: string,
    channelId: string | null,
    lifecycle?: TYPES.IMessageLifecycle
  ) {
    const summary = await generateText(
      this.modelInfo.generation,
      this.modelInfo.generation.apiKey!,
      systemPrompt,
      summaryPrompt
    );
    const embedding = await generateEmbeddings(
      this.modelInfo.embedding,
      this.modelInfo.embedding.apiKey!,
      summary
    );

    // Create Memory
    const memoryId = nanoid();
    await this.db.insert(ContextServerSchema.memories).values({
      id: memoryId,
      daemonId: daemonId,
      channelId: channelId,
      createdAt: new Date(),
      content: summary,
      embedding: embedding,
      originalLifecycle: lifecycle,
    });

    return {
      memoryId,
      summary,
      embedding,
    };
  }
}

function checkApproval(daemonKey: string, lifecycle: TYPES.IMessageLifecycle) {
  const messageBytes = decodeUTF8(
    JSON.stringify(
      {
        message: lifecycle.message,
        createdAt: lifecycle.createdAt,
      },
      null,
      0
    )
  );

  const pubkey = new PublicKey(daemonKey);
  return nacl.sign.detached.verify(
    messageBytes,
    Uint8Array.from(Buffer.from(lifecycle.approval, "base64")),
    pubkey.toBytes()
  );
}

const settings = {
  key: text("key").primaryKey(),
  value: text("value"),
};

const daemons = {
  id: text("id").primaryKey(),
  character: jsonb("character"),
  pubkey: text("pubkey").notNull(),
};

const memories = {
  id: text("id").primaryKey(),
  daemonId: text("daemon_id").notNull(),
  channelId: text("channel_id"),
  createdAt: timestamp("created_at").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1 }).notNull(), // Dimensions is just a placeholder, gets overwrriten on creation
  originalLifecycle: jsonb("original_lifecycle"),
};

const logs = {
  id: text("id").primaryKey(),
  daemonId: text("daemon_id").notNull(),
  channelId: text("channel_id"),
  createdAt: timestamp("created_at").notNull(),
  lifecycle: jsonb("lifecycle").notNull(),
};

let ContextServerSchema = {
  daemons: pgTable("daemons", daemons),
  memories: pgTable("memories", memories),
  logs: pgTable("logs", logs),
  settings: pgTable("settings", settings),
};
