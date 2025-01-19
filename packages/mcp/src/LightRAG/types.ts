export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

export interface PostgresConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface StorageConfig {
  neo4j: Neo4jConfig;
  postgres: PostgresConfig;
  openai: {
    apiKey: string;
    model?: string; // optional, will default to text-embedding-3-small
    entityExtractionModel?: string; // optional, will default to gpt-4o
  };
}

// Common interfaces for both graph and vector storage
export interface BaseStorageItem {
  id: string;
  text: string;
  channelId?: string;
  timestamp: number;
  daemonPubkey: string;  // Required field for all storage items
}

export interface VectorData extends BaseStorageItem {
  vector: number[];
  similarity?: number;
}

export interface GraphNode extends BaseStorageItem {
  type: string;
}

export interface GraphRelation {
  sourceId: string;
  targetId: string;
  type: string;
  channelId?: string;
  daemonPubkey: string;  // Adding required daemonPubkey
}

// Entity extraction types
export interface Entity {
  name: string;
  type: string;
  description: string;
  daemonPubkey: string;  // Adding required daemonPubkey
  channelId?: string;    // Adding optional channelId
}

export interface Relationship {
  sourceEntity: string;
  targetEntity: string;
  description: string;
  keywords: string[];
  strength: number;
}

export interface ExtractedContent {
  entities: Entity[];
  relationships: Relationship[];
  contentKeywords: string[];
}
