import neo4j, { Driver, Session } from 'neo4j-driver';
import type { Neo4jConfig, GraphNode, GraphRelation } from './types';

export class Neo4jStorage {
  private driver: Driver;
  private database?: string;

  constructor(config: Neo4jConfig) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password),
      {
        encrypted: false,
        trust: 'TRUST_ALL_CERTIFICATES',
        maxConnectionPoolSize: 50,
        connectionTimeout: 5000
      }
    );
    this.database = config.database ?? 'lightrag';
  }

  async init(): Promise<void> {
    try {
      
      // Use the default 'neo4j' database if no specific database is set
      this.database = this.database || 'neo4j';
      
      // Verify connection using the selected database
      const session = this.driver.session({ database: this.database });
      try {
        await session.run('RETURN 1');
        console.log(`Successfully connected to Neo4j database: ${this.database}`);
      } finally {
        await session.close();
      }
    } catch (error) {
      console.error("Neo4j initialization error:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  private getSession(): Session {
    try {
      return this.driver.session({ database: this.database });
    } catch (error) {
      throw new Error(`Failed to connect to Neo4j: ${error}`);
    }
  }

  async insertNode(node: GraphNode): Promise<void> {
    const session = this.getSession();
    try {
      await session.executeWrite(async (tx) => {
        // Filter out undefined properties
        const properties = {
          id: node.id,
          text: node.text,
          type: node.type,
          timestamp: node.timestamp,
          daemonPubkey: node.daemonPubkey,
          ...(node.channelId ? { channelId: node.channelId } : {})
        };

        const query = `
          CREATE (n:Node)
          SET n = $properties
        `;
        
        await tx.run(query, { properties });
      });
    } finally {
      await session.close();
    }
  }

  async insertRelation(relation: GraphRelation): Promise<void> {
    const session = this.getSession();
    try {
      await session.executeWrite(async (tx) => {
        const query = `
          MATCH (source:Node {id: $sourceId})
          MATCH (target:Node {id: $targetId})
          CREATE (source)-[r:${relation.type} {
            channelId: $channelId,
            daemonPubkey: $daemonPubkey
          }]->(target)
        `;
        await tx.run(query, relation);
      });
    } finally {
      await session.close();
    }
  }

  async query(text: string, daemonPubkey: string, channelId?: string): Promise<GraphNode[]> {
    const session = this.getSession();
    try {
      const result = await session.executeRead(async (tx) => {
        const channelFilter = channelId 
          ? 'AND n.channelId = $channelId'
          : '';
        
        const query = `
          MATCH (n:Node)
          WHERE n.text CONTAINS $text 
          AND n.daemonPubkey = $daemonPubkey
          ${channelFilter}
          RETURN n
          ORDER BY n.timestamp DESC
          LIMIT 10
        `;
        
        const params = channelId ? { text, daemonPubkey, channelId } : { text, daemonPubkey };
        const response = await tx.run(query, params);
        return response.records.map(record => record.get('n').properties as GraphNode);
      });
      return result;
    } finally {
      await session.close();
    }
  }

  async clear(): Promise<void> {
    const session = this.getSession();
    try {
      await session.executeWrite(async (tx) => {
        await tx.run('MATCH (n) DETACH DELETE n');
      });
    } finally {
      await session.close();
    }
  }
}
