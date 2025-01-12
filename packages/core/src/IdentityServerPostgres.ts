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

  private embeddingInfo: {
    model: string;
    dimensions: number;
  };
  private initialized: boolean = false;

  constructor(
    pgOpts: PoolConfig,
    embeddingOpts?: { embeddingModel: string; embeddingDimensions: number },
    serverOpts?: { name?: string; port?: number }
  ) {
    this.db = drizzle(new Pool(pgOpts), {
      schema: ContextServerSchema,
      casing: "snake_case",
    });
    this.embeddingInfo = {
      model: embeddingOpts?.embeddingModel || "openai",
      dimensions: embeddingOpts?.embeddingDimensions || 1536,
    };

    this.server = new LiteMCP(serverOpts?.name || "context-server", "1.0.0");
  }

  async init(opts?: {
    embeddingModel: string;
    embeddingDimensions: number;
  }): Promise<void> {
    // Enable pgvector extension
    await this.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

    const getEmbeddingInfo = async (
      embeddingModel: string,
      embeddingDimensions: number
    ): Promise<{ model: string; dimensions: number }> => {
      try {
        const fetchedModel = await this.db
          .select()
          .from(ContextServerSchema.settings)
          .where(eq(ContextServerSchema.settings.key, "embedding_model"))
          .limit(1)
          .execute();

        if (fetchedModel.length === 0) {
          await this.db.execute(
            sql`INSERT INTO settings (key, value) VALUES ('embedding_model', ${embeddingModel});`
          );
        }

        const fetchedDimensions = await this.db
          .select()
          .from(ContextServerSchema.settings)
          .where(eq(ContextServerSchema.settings.key, "embedding_dimensions"))
          .limit(1)
          .execute();

        if (fetchedDimensions.length === 0) {
          await this.db.execute(
            sql`INSERT INTO settings (key, value) VALUES ('embedding_dimensions', ${embeddingDimensions.toString()});`
          );
        }

        return {
          model: fetchedModel[0]?.value || embeddingModel,
          dimensions:
            Number(fetchedDimensions[0]?.value) || embeddingDimensions,
        };
      } catch (e) {
        await this.db.execute(
          sql`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text);`
        );

        await this.db.execute(
          sql`INSERT INTO settings (key, value) VALUES ('embedding_model', ${embeddingModel});`
        );

        await this.db.execute(
          sql`INSERT INTO settings (key, value) VALUES ('embedding_dimensions', ${embeddingDimensions.toString()});`
        );
        return {
          model: embeddingModel,
          dimensions: embeddingDimensions,
        };
      }
    };

    const { model, dimensions } = await getEmbeddingInfo(
      opts?.embeddingModel || "openai",
      opts?.embeddingDimensions || 1536
    );

    this.embeddingInfo = {
      model,
      dimensions,
    };

    await this.db.execute(
      sql`CREATE TABLE IF NOT EXISTS daemons (id text PRIMARY KEY, character jsonb, pubkey text NOT NULL)`
    );
    console.log("Created daemons table");

    // Memories
    await this.db.execute(
      sql`CREATE TABLE IF NOT EXISTS memories (id text PRIMARY KEY, daemonId text NOT NULL, channelId text, createdAt timestamp NOT NULL, content text NOT NULL, embedding vector(${sql.raw(
        dimensions.toString()
      )}) NOT NULL, originationLogIds jsonb NOT NULL)`
    );
    console.log("Created memories table");

    await this.db.execute(
      sql`CREATE INDEX IF NOT EXISTS "embeddingIndex" ON "memories" USING hnsw (embedding vector_cosine_ops)`
    );
    console.log("Created embeddingIndex");

    // Logs
    await this.db.execute(
      sql`CREATE TABLE IF NOT EXISTS logs (id text PRIMARY KEY, daemonId text NOT NULL, channelId text, createdAt timestamp NOT NULL, content text NOT NULL, "type" text NOT NULL)`
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
        return await this.registerCharacter(character);
      },
    });

    this.server.addTool({
      name: "fetchCharacter",
      description: "Fetch a character",
      parameters: z.object({
        daemonId: z.string(),
      }),
      execute: async (args: { daemonId: string }) => {
        return {
          type: "text",
          text: JSON.stringify(
            (await this.fetchCharacter(args.daemonId)) || {}
          ),
        };
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
        return {
          type: "text",
          text: JSON.stringify(await this.fetchLogs(args)),
        };
      },
    });

    // Context Tools
    this.server.addTool({
      name: "fetchMemoryContext",
      description: "Fetch memory context",
      parameters: z.object({
        daemonId: z.string(),
        messageEmbedding: z.array(z.number()),
        limit: z.number(),
        similarityThreshold: z.number().optional(),
        channelId: z.string().optional(),
      }),
      execute: async (args) => {
        return {
          type: "text",
          text: JSON.stringify(await this.fetchMemoryContext(args)),
        };
      },
    });
    // Action Tools
    // Post Process Tools
    this.server.addTool({
      name: "createMemory",
      description: "Create a memory",
      parameters: z.object({
        opts: z.object({
          daemonId: z.string(),
          message: z.string(),
          messageEmbedding: z.array(z.number()),
          channelId: z.string().optional(),
          originationLogIds: z.array(z.string()).optional(),
        }),
        approval: z.object({
          signature: z.string(),
        }),
      }),
      execute: async (args) => {
        return await this.createMemory(args.opts, args.approval);
      },
    });

    this.server.addTool({
      name: "createLog",
      description: "Insert a log",
      parameters: z.object({
        log: z.object({
          daemonId: z.string(),
          channelId: z.string().nullable(),
          content: z.string(),
          logType: z.enum(["input", "output"]),
        }),
        approval: z.object({
          signature: z.string(),
        }),
      }),
      execute: async (args) => {
        return {
          type: "text",
          text: JSON.stringify(await this.createLog(args.log, args.approval)),
        };
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
  async listServerTools(): Promise<TYPES.Tool[]> {
    return [
      {
        name: "registerCharacter",
        description: "Register a new character",
        type: "Server",
        inputParameters: [
          {
            name: "character",
            description: "The character to register",
            type: "object",
          },
        ],
      },
      {
        name: "fetchCharacter",
        description: "Fetch a character",
        type: "Server",
        inputParameters: [
          {
            name: "daemonId",
            description: "The daemon ID",
            type: "string",
          },
        ],
      },
      {
        name: "fetchLogs",
        description: "Fetch logs",
        type: "Server",
        inputParameters: [
          {
            name: "daemonId",
            description: "The daemon ID",
            type: "string",
          },
        ],
      },
    ];
  }

  async listContextTools(): Promise<TYPES.Tool[]> {
    return [
      {
        name: "fetchMemoryContext",
        description: "Fetch memory context",
        type: "Context",
        inputParameters: [
          {
            name: "daemonId",
            description: "The daemon ID",
            type: "string",
          },
        ],
      },
    ];
  }

  async listActionTools(): Promise<TYPES.Tool[]> {
    return [];
  }

  async listPostProcessTools(): Promise<TYPES.Tool[]> {
    return [
      {
        name: "createLog",
        description: "Create a log",
        type: "PostProcess",
        inputParameters: [
          {
            name: "log",
            description: "The log to create",
            type: "object",
          },
        ],
      },
      {
        name: "createMemory",
        description: "Create a memory",
        type: "PostProcess",
        inputParameters: [
          {
            name: "opts",
            description: "The options for the memory",
            type: "object",
          },
        ],
      },
    ];
  }

  // Server Tools
  async registerCharacter(character: TYPES.Character): Promise<string> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    const daemonId = nanoid();
    await this.db.insert(ContextServerSchema.daemons).values({
      id: daemonId,
      character,
      pubkey: character.pubkey,
    });
    return daemonId;
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

    return logs.map((log) => ({
      ...log,
      logType: log.logType as "input" | "output",
    }));
  }

  // Context Tools
  async fetchMemoryContext(opts: {
    daemonId: string;
    messageEmbedding: number[];
    limit: number;
    similarityThreshold?: number;
    channelId?: string;
  }): Promise<TYPES.IMemory[]> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    const similarityThreshold = opts.similarityThreshold || 0.85;

    const similarity = sql<number>`1 - (${cosineDistance(
      ContextServerSchema.memories.embedding,
      opts.messageEmbedding
    )})`;

    const relevantMemories = await this.db
      .select()
      .from(ContextServerSchema.memories)
      .where(
        and(
          eq(ContextServerSchema.memories.daemonId, opts.daemonId),
          opts.channelId
            ? eq(ContextServerSchema.memories.channelId, opts.channelId)
            : undefined,
          gte(similarity, similarityThreshold)
        )
      )
      .orderBy(desc(similarity))
      .limit(opts.limit)
      .execute();

    return relevantMemories.map((memory) => ({
      ...memory,
      originationLogIds: memory.originationLogIds as string[],
    }));
  }

  // Action Tools

  // Post Process Tools
  async createLog(log: TYPES.ILog, approval: TYPES.IApproval): Promise<void> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    // Fetch Daemon Pubkey
    const daemon = await this.db
      .select({
        pubkey: ContextServerSchema.daemons.pubkey,
      })
      .from(ContextServerSchema.daemons)
      .where(eq(ContextServerSchema.daemons.id, log.daemonId))
      .execute();
    const daemonPubkey = daemon[0]?.pubkey;

    if (!checkApproval(log, daemonPubkey, approval)) {
      throw new Error("Approval failed");
    }

    await this.db.insert(ContextServerSchema.logs).values({
      id: log.id || nanoid(),
      ...log,
      createdAt: new Date(),
    });
  }

  async createMemory(
    opts: {
      daemonId: string;
      message: string;
      messageEmbedding: number[];
      channelId?: string;
      originationLogIds?: string[];
    },
    approval: TYPES.IApproval
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    if (opts.messageEmbedding.length !== this.embeddingInfo.dimensions) {
      throw new Error(
        `Embedding dimensions mismatch. Expected ${this.embeddingInfo.dimensions}, got ${opts.messageEmbedding.length}`
      );
    }

    // Fetch Daemon Pubkey
    const daemon = await this.db
      .select({
        pubkey: ContextServerSchema.daemons.pubkey,
      })
      .from(ContextServerSchema.daemons)
      .where(eq(ContextServerSchema.daemons.id, opts.daemonId))
      .execute();
    const daemonPubkey = daemon[0]?.pubkey;

    if (!checkApproval(opts, daemonPubkey, approval)) {
      throw new Error("Approval failed");
    }

    const memoryId = nanoid();
    await this.db.insert(ContextServerSchema.memories).values({
      id: memoryId,
      daemonId: opts.daemonId,
      channelId: opts.channelId,
      createdAt: new Date(),
      content: opts.message,
      embedding: opts.messageEmbedding,
      originationLogIds: opts.originationLogIds || [],
    });
    return memoryId;
  }
}

const checkApproval = (
  opts: any,
  publicKey: string,
  approval: TYPES.IApproval
) => {
  const hasher = new Bun.CryptoHasher("sha256");
  const message = JSON.stringify(opts, null, 0);
  hasher.update(message);
  const hash = hasher.digest("hex");
  const pubkey = new PublicKey(publicKey);

  return nacl.sign.detached.verify(
    Buffer.from(hash, "hex"),
    Buffer.from(approval.signature, "base64"),
    pubkey.toBytes()
  );
};

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
  originationLogIds: jsonb("origination_log_ids").notNull(),
};

const logs = {
  id: text("id").primaryKey(),
  daemonId: text("daemon_id").notNull(),
  channelId: text("channel_id"),
  createdAt: timestamp("created_at").notNull(),
  content: text("content").notNull(),
  logType: text("log_type").notNull(),
};

let ContextServerSchema = {
  daemons: pgTable("daemons", daemons),
  memories: pgTable("memories", memories),
  logs: pgTable("logs", logs),
  settings: pgTable("settings", settings),
};
