import postgres from 'postgres';
import type { PostgresConfig, VectorData } from './types';
import cosineSimilarity from 'compute-cosine-similarity';

export class PostgresStorage {
  private sql: postgres.Sql<{}>;
  private config: PostgresConfig;

  constructor(config: PostgresConfig) {
    this.config = config;
    this.sql = postgres({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: 'postgres', // Connect to default postgres database first
    });
  }

  async init(): Promise<void> {
    const dbName = this.config.database ?? "lightrag";
    
    // Check if database exists
    const dbExists = await this.sql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    // Create database if it doesn't exist
    if (dbExists.length === 0) {
      await this.sql`CREATE DATABASE ${this.sql(dbName)}`;
    }

    // Close connection to postgres database
    await this.sql.end();

    // Connect to our database
    this.sql = postgres({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: dbName,
    });

    // Create tables
    await this.sql`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        vector FLOAT[] NOT NULL,
        channel_id TEXT,
        daemon_pubkey TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_vectors_channel 
      ON vectors(channel_id);

      CREATE INDEX IF NOT EXISTS idx_vectors_daemon_pubkey
      ON vectors(daemon_pubkey);
    `;
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  async insert(data: VectorData): Promise<void> {
    await this.sql`
      INSERT INTO vectors (id, text, vector, channel_id, daemon_pubkey, timestamp)
      VALUES (${data.id}, ${data.text}, ${data.vector}, ${data.channelId ?? null}, ${data.daemonPubkey}, ${data.timestamp})
      ON CONFLICT (id) DO UPDATE
      SET text = EXCLUDED.text,
          vector = EXCLUDED.vector,
          channel_id = EXCLUDED.channel_id,
          daemon_pubkey = EXCLUDED.daemon_pubkey,
          timestamp = EXCLUDED.timestamp
    `;
  }

  async query(vector: number[], daemonPubkey: string, channelId?: string, limit: number = 10): Promise<VectorData[]> {
    let result;
    if (channelId) {
      result = await this.sql`
        SELECT id, text, vector, channel_id as "channelId", daemon_pubkey as "daemonPubkey", timestamp
        FROM vectors
        WHERE channel_id = ${channelId}
        AND daemon_pubkey = ${daemonPubkey}
      `;
    } else {
      result = await this.sql`
        SELECT id, text, vector, channel_id as "channelId", daemon_pubkey as "daemonPubkey", timestamp
        FROM vectors
        WHERE daemon_pubkey = ${daemonPubkey}
      `;
    }
    
    // Calculate cosine similarity in memory
    const similarities = result.map(row => ({ ...row, similarity: cosineSimilarity(vector, row.vector) })) as (VectorData & { similarity: number })[];

    // Sort by similarity and return top results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async clear(): Promise<void> {
    await this.sql`TRUNCATE TABLE vectors`;
  }
}
