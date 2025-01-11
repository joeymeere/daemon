import { FastMCP } from "fastmcp";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import type {
  Character,
  IContextServer,
  IDaemon,
  ILog,
  IMemory,
} from "./types";
import { eq, desc, asc, and, cosineDistance, gte } from "drizzle-orm";
import { pgTable, timestamp } from "drizzle-orm/pg-core";
import { jsonb, text, uuid, vector } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";

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
  private embeddingInfo: {
    model: string;
    dimensions: number;
  };
  private initialized: boolean = false;

  constructor(
    pgOpts: PoolConfig,
    embeddingOpts?: { embeddingModel: string; embeddingDimensions: number }
  ) {
    this.poolConfig = pgOpts;
    this.db = drizzle(
      {
        client: new Pool(pgOpts),
        schema: ContextServerSchema,
      },
      {
        casing: "snake_case",
      }
    );
    this.embeddingInfo = {
      model: embeddingOpts?.embeddingModel || "openai",
      dimensions: embeddingOpts?.embeddingDimensions || 1536,
    };
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
    this.db = drizzle(
      {
        client: new Pool(this.poolConfig),
        schema: updatedMemoriesWithEmbedding,
      },
      {
        casing: "snake_case",
      }
    );

    this.initialized = true;
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

  async createMemory(opts: {
    daemonId: string;
    message: string;
    messageEmbedding: number[];
    channelId?: string;
    originationLogIds?: string[];
  }): Promise<string> {
    if (!this.initialized) {
      throw new Error("Context Server not initialized");
    }

    if (opts.messageEmbedding.length !== this.embeddingInfo.dimensions) {
      throw new Error(
        `Embedding dimensions mismatch. Expected ${this.embeddingInfo.dimensions}, got ${opts.messageEmbedding.length}`
      );
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

  async insertLog(opts: { log: ILog }): Promise<void> {
    await this.db.insert(ContextServerSchema.logs).values({
      id: opts.log.id || nanoid(),
      ...opts.log,
      createdAt: new Date(),
    });
  }
}

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
