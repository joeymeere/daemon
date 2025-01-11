import { FastMCP } from "fastmcp";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import {
  type Approval,
  type Character,
  type IContextServer,
  type ILog,
  type IMemory,
} from "./types";
import { eq, desc, asc, and, cosineDistance, gte } from "drizzle-orm";
import { pgTable, timestamp } from "drizzle-orm/pg-core";
import { jsonb, text, uuid, vector } from "drizzle-orm/pg-core";
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
export class ContextServerPostgres implements IContextServer {
  private db: NodePgDatabase<typeof ContextServerSchema>;
  private poolConfig: PoolConfig;
  private server: FastMCP;

  private embeddingInfo: {
    model: string;
    dimensions: number;
  };
  private initialized: boolean = false;

  constructor(
    pgOpts: PoolConfig,
    serverOpts?: { name?: string; port?: number },
    embeddingOpts?: { embeddingModel: string; embeddingDimensions: number }
  ) {
    this.poolConfig = pgOpts;
    this.db = drizzle(new Pool(pgOpts), {
      schema: ContextServerSchema,
      casing: "snake_case",
    });
    this.embeddingInfo = {
      model: embeddingOpts?.embeddingModel || "openai",
      dimensions: embeddingOpts?.embeddingDimensions || 1536,
    };

    this.server = new FastMCP({
      name: serverOpts?.name || "Daemon Context Server",
      version: "0.0.1",
    });
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
    ) => {
      try {
        const fetchedModel = await this.db
          .select()
          .from(ContextServerSchema.settings)
          .where(eq(ContextServerSchema.settings.key, "embedding_model"))
          .limit(1)
          .execute();

        const fetchedDimensions = await this.db
          .select()
          .from(ContextServerSchema.settings)
          .where(eq(ContextServerSchema.settings.key, "embedding_dimensions"))
          .limit(1)
          .execute();

        return {
          model: fetchedModel[0]?.value || embeddingModel,
          dimensions:
            Number(fetchedDimensions[0]?.value) || embeddingDimensions,
        };
      } catch (e) {
        await this.db.execute(
          sql`
          CREATE TABLE settings (key text PRIMARY KEY, value text); 
          INSERT INTO settings (key, value) VALUES ('embedding_model', '${embeddingModel}');
          INSERT INTO settings (key, value) VALUES ('embedding_dimensions', '${embeddingDimensions}');
          `
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

    // Check if tables exist and if not, initialize them
    // Daemons
    try {
      await this.db
        .select()
        .from(ContextServerSchema.daemons)
        .limit(1)
        .execute();
    } catch (e) {
      await this.db.execute(
        sql`CREATE TABLE daemons (id uuid PRIMARY KEY, character jsonb, pubkey text NOT NULL)`
      );
    }

    // Memories
    try {
      await this.db
        .select()
        .from(ContextServerSchema.memories)
        .limit(1)
        .execute();
    } catch (e) {
      await this.db.execute(
        sql`
        CREATE TABLE memories (id uuid PRIMARY KEY, daemonId uuid NOT NULL, channelId uuid, createdAt timestamp NOT NULL, content text NOT NULL, embedding vector(dimensions) NOT NULL, originationLogIds uuid[] NOT NULL); 
        CREATE INDEX IF NOT EXISTS "embeddingIndex" ON "memories" USING hnsw (embedding vector_cosine_ops);
        `
      );
    }

    const updatedMemoriesWithEmbedding = {
      ...ContextServerSchema.memories,
      embedding: vector("embedding", {
        dimensions: dimensions,
      }),
    };

    // Logs
    try {
      await this.db.select().from(ContextServerSchema.logs).limit(1).execute();
    } catch (e) {
      await this.db.execute(
        sql`CREATE TABLE logs (id uuid PRIMARY KEY, daemonId uuid NOT NULL, channelId uuid, createdAt timestamp NOT NULL, content text NOT NULL, type text NOT NULL)`
      );
    }

    // Reinitialize db instance with the updated Memories Schema
    this.db = drizzle(new Pool(this.poolConfig), {
      schema: ContextServerSchema,
      casing: "snake_case",
    });

    this.initialized = true;
  }

  async start(port?: number): Promise<void> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    // Server Tools
    this.server.addTool({
      name: "registerCharacter",
      description: "Register a new character",
      parameters: z.object({
        name: z.string(),
        bio: z.array(z.string()),
        lore: z.array(z.string()),
        pubkey: z.string(),
        contextServer: z.string(),
      }),
      execute: async (character: Character) => {
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
    await this.server.stop();
  }

  async registerCharacter(character: Character): Promise<string> {
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

  async fetchCharacter(daemonId: string): Promise<Character | undefined> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    const character = await this.db
      .select()
      .from(ContextServerSchema.daemons)
      .where(eq(ContextServerSchema.daemons.id, daemonId))
      .execute();
    return character[0]?.character as Character | undefined;
  }

  async fetchLogs(opts: {
    daemonId: string;
    channelId?: string;
    limit?: number;
    orderBy?: "asc" | "desc";
  }): Promise<ILog[]> {
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

  async fetchMemoryContext(opts: {
    daemonId: string;
    messageEmbedding: number[];
    limit: number;
    similarityThreshold?: number;
    channelId?: string;
  }): Promise<IMemory[]> {
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

    return relevantMemories;
  }

  async createLog(log: ILog, approval: Approval): Promise<void> {
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
    approval: Approval
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

const checkApproval = (opts: any, publicKey: string, approval: Approval) => {
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
  id: uuid("id").primaryKey(),
  character: jsonb("character"),
  pubkey: text("pubkey").notNull(),
};

const memories = {
  id: uuid("id").primaryKey(),
  daemonId: uuid("daemon_id").notNull(),
  channelId: uuid("channel_id"),
  createdAt: timestamp("created_at").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", {
    dimensions: 1536, // will get overriden on init
  }).notNull(),
  originationLogIds: uuid("origination_log_ids").array().notNull(),
};

const logs = {
  id: uuid("id").primaryKey(),
  daemonId: uuid("daemon_id").notNull(),
  channelId: uuid("channel_id"),
  createdAt: timestamp("created_at").notNull(),
  content: text("content").notNull(),
  logType: text("log_type").notNull(),
};

const ContextServerSchema = {
  daemons: pgTable("daemons", daemons),
  memories: pgTable("memories", memories),
  logs: pgTable("logs", logs),
  settings: pgTable("settings", settings),
};
