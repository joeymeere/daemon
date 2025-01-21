import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { pgTable, timestamp, vector, text } from "drizzle-orm/pg-core";
import { cosineDistance } from "drizzle-orm";
import { sql, eq, desc, gte, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { AIConfig, PostgresConfig } from "./types";
import { embed } from "ai";
import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";

export class RecencyRAG {
    private db: PostgresJsDatabase<typeof RecencyRAGSchema> | undefined;
    private aiConfig: AIConfig;
    private openai: OpenAIProvider | undefined;

    constructor(aiConfig: AIConfig, postgresConfig: PostgresConfig) {
        this.db = drizzle({
            connection: postgresConfig,
            schema: RecencyRAGSchema,
            casing: "snake_case",
        });
        this.aiConfig = aiConfig;
        this.openai =  createOpenAI({
            baseURL: aiConfig.baseUrl ?? "https://api.openai.com/v1",
            apiKey: aiConfig.apiKey ?? process.env.OPENAI_API_KEY
        });
    }

    async init() {
        try {
            await this.db?.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

            await this.db?.execute(sql`CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                from TEXT NOT NULL,
                message TEXT NOT NULL,
                embeddings VECTOR(${this.aiConfig.vectorDimensions}) NOT NULL,
                timestamp TIMESTAMP DEFAULT NOW(),
                daemon_pubkey TEXT NOT NULL,
                channel_id TEXT
            )`);

            await this.db?.execute(sql`CREATE INDEX IF NOT EXISTS ON messages (timestamp)`);
            await this.db?.execute(sql`CREATE INDEX IF NOT EXISTS ON messages (daemon_pubkey, channel_id)`);
            await this.db?.execute(sql`CREATE INDEX IF NOT EXISTS ON messages (channel_id)`);
        } catch (error) {
            console.error("Failed to initialize RecencyRAG: ", error)
            throw error;
        }
    }

    async close() {}
    async insert(text: string, from: "user"| "agent", daemonPubkey: string, channelId?: string) {
        try {
            // Will be called twice, once for user message and once for AI message

            // Get embeddings on Text
            const embeddings = (await embed({
                model: this.openai!.textEmbeddingModel(this.aiConfig.embeddingModel ?? "text-embedding-3-small"),
                value: text,
            })).embedding as number[]; // Array<Number>


            const id = nanoid();
            await this.db?.insert(RecencyRAGSchema.messages).values({
                id: id,
                from,
                message: text,
                embeddings: embeddings,
                daemon_pubkey: daemonPubkey,
                channel_id: channelId ?? ""
            })

            return id;
        } catch (e: any){
            console.error("Failed to insert into RecencyRAG: ", e);
            throw e;
        }
    }
    async query(text: string, daemonPubkey: string, channelId?: string): Promise<string[]> {
        try {
            // Get embeddings for text

            const embeddings = (await embed({
                model: this.openai!.textEmbeddingModel(this.aiConfig.embeddingModel ?? "text-embedding-3-small"),
                value: text,
            })).embedding as number[]; // Array<Number>

            // Vector Text
            const similarityThreshold = 0.85; // TODO: Make this configurable
            const limit = 5; // TODO: Make this configurable
            const similarity = sql<number>`1 - (${cosineDistance(
                RecencyRAGSchema.messages.embeddings,
                embeddings
            )})`;

            // Get messages that match the vector search and belong to the daemon and channel_id

            const vectorSearchResults = await this.db?.select().from(RecencyRAGSchema.messages)
                .where(and(
                    eq(RecencyRAGSchema.messages.daemon_pubkey, daemonPubkey),
                    eq(RecencyRAGSchema.messages.channel_id, channelId ?? ""),
                    gte(similarity, similarityThreshold)
                ))
                .orderBy(desc(similarity))
                .limit(limit) ?? [];

            // Get last Y messages from channel_id that belong to the daemon
            const lastYMessages = await this.db?.select().from(RecencyRAGSchema.messages)
                .where(and(
                    eq(RecencyRAGSchema.messages.daemon_pubkey, daemonPubkey),
                    eq(RecencyRAGSchema.messages.channel_id, channelId ?? ""),
                ))
                .orderBy(desc(RecencyRAGSchema.messages.timestamp))
                .limit(limit) ?? [];

            return [...vectorSearchResults.map(result => result.message ?? ""), ...lastYMessages.map(result => result.message ?? "")];
        } catch (e: any){
            console.error("Failed to query RecencyRAG: ", e);
            throw e;
        }
    }
}

const messages = {
    id: text("id").primaryKey(),
    from: text("from"), // User or Agent
    message: text("message"),
    embeddings: vector("embeddings", {dimensions: 1536}).notNull(),
    timestamp: timestamp("timestamp").defaultNow(),
    channel_id: text("channel_id"),
    daemon_pubkey: text("daemon_pubkey").notNull(),
};

let RecencyRAGSchema = {
    messages: pgTable("messages", messages),
};

// RecenyRAG returns 2 sets of results
   // 1. Top N Vector Search Results
   // 2. Last Y Messages from Channel