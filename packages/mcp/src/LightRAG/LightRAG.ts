import OpenAI from 'openai';
import type{ StorageConfig, VectorData, GraphNode, GraphRelation } from './types';
import { Neo4jStorage } from './neo4j';
import { PostgresStorage } from './postgres';
import { nanoid} from 'nanoid';

export class LightRAG {
  private neo4j: Neo4jStorage;
  private postgres: PostgresStorage;
  private openai: OpenAI;
  private embeddingModel: string;

  constructor(config: StorageConfig) {
    this.neo4j = new Neo4jStorage(config.neo4j);
    this.postgres = new PostgresStorage(config.postgres);
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    this.embeddingModel = config.openai.model || 'text-embedding-3-small';
  }

  async init(): Promise<void> {
    await Promise.all([
      this.neo4j.init(),
      this.postgres.init()
    ]);
  }

  async close(): Promise<void> {
    await Promise.all([
      this.neo4j.close(),
      this.postgres.close()
    ]);
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.neo4j.clear(),
      this.postgres.clear()
    ]);
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: text
    });
    
    return response.data[0].embedding;
  }

  async insert(text: string, daemonPubkey: string, channelId?: string): Promise<void> {
    const timestamp = Date.now();
    const id = nanoid();
    const vector = await this.getEmbedding(text);

    // Create vector data
    const vectorData: VectorData = {
      id,
      text,
      vector,
      channelId,
      daemonPubkey,
      timestamp
    };

    // Create graph node
    const node: GraphNode = {
      id,
      text,
      type: 'text',
      channelId,
      daemonPubkey,
      timestamp
    };

    // Insert into both storages
    await Promise.all([
      this.postgres.insert(vectorData),
      this.neo4j.insertNode(node)
    ]);
  }

  async query(text: string, daemonPubkey: string, channelId?: string): Promise<Array<{text: string, score: number}>> {
    // Get vector for query text
    const queryVector = await this.getEmbedding(text);

    // Query both storages
    const [vectorResults, graphResults] = await Promise.all([
      this.postgres.query(queryVector, daemonPubkey, channelId),
      this.neo4j.query(text, daemonPubkey, channelId)
    ]);

    // Combine and deduplicate results
    const seen = new Set<string>();
    const results: Array<{text: string, score: number}> = [];

    // Add vector results first (they have similarity scores)
    for (const result of vectorResults) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        results.push({
          text: result.text,
          score: result.similarity || 0
        });
      }
    }

    // Add graph results (with a default score)
    for (const result of graphResults) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        results.push({
          text: result.text,
          score: 0.5  // Default score for graph matches
        });
      }
    }

    // Sort by score
    return results.sort((a, b) => b.score - a.score);
  }
}