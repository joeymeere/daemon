import OpenAI from 'openai';
import type{ StorageConfig, VectorData, GraphNode, GraphRelation, Entity, Relationship, ExtractedContent } from './types';
import { Neo4jStorage } from './neo4j';
import { PostgresStorage } from './postgres';
import { nanoid} from 'nanoid';

// Default entity types from Python implementation
const DEFAULT_ENTITY_TYPES = ["organization", "person", "geo", "event", "category"];

export class LightRAG {
  private neo4j: Neo4jStorage;
  private postgres: PostgresStorage;
  private openai: OpenAI;
  private embeddingModel: string;
  private entityExtractionModel: string;

  constructor(config: StorageConfig) {
    this.neo4j = new Neo4jStorage(config.neo4j);
    this.postgres = new PostgresStorage(config.postgres);
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    this.embeddingModel = config.openai.model || 'text-embedding-3-small';
    this.entityExtractionModel = config.openai.entityExtractionModel || 'gpt-4o-mini';
  }

  async init(): Promise<void> {
    try {
      await Promise.all([
        this.neo4j.init(),
        this.postgres.init()
      ]);
    } catch (error) {
      console.error("Failed to initialize LightRAG: ", error)
      throw new Error(`Failed to initialize LightRAG: ${error}`);
    }
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

  private async extractEntities(text: string, daemonPubkey: string, channelId?: string): Promise<ExtractedContent> {
    // Using the same prompt structure as the Python implementation
    const prompt = `-Goal-
Given a text document that is potentially relevant to this activity and a list of entity types, identify all entities of those types from the text and all relationships among the identified entities.
Use English as output language.

-Steps-
1. Identify all entities. For each identified entity, extract the following information:
- entity_name: Name of the entity, use same language as input text. If English, capitalized the name.
- entity_type: One of the following types: [${DEFAULT_ENTITY_TYPES.join(', ')}]
- entity_description: Comprehensive description of the entity's attributes and activities
Format each entity as ("entity"<|><entity_name><|><entity_type><|><entity_description>)

2. From the entities identified in step 1, identify all pairs of (source_entity, target_entity) that are *clearly related* to each other.
For each pair of related entities, extract the following information:
- source_entity: name of the source entity, as identified in step 1
- target_entity: name of the target entity, as identified in step 1
- relationship_description: explanation as to why you think the source entity and the target entity are related to each other
- relationship_strength: a numeric score indicating strength of the relationship between the source entity and target entity
- relationship_keywords: one or more high-level key words that summarize the overarching nature of the relationship
Format each relationship as ("relationship"<|><source_entity><|><target_entity><|><relationship_description><|><relationship_keywords><|><relationship_strength>)

3. Identify high-level key words that summarize the main concepts, themes, or topics of the entire text.
Format the content-level key words as ("content_keywords"<|><high_level_keywords>)

Text: ${text}`;

    const response = await this.openai.chat.completions.create({
      model: this.entityExtractionModel,
      messages: [
        {
          role: "system",
          content: "You are a precise entity and relationship extractor. Follow the format exactly as specified."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    });

    const output = response.choices[0].message.content || '';
    const lines = output.split('##').filter(line => line.trim());
    
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];
    let contentKeywords: string[] = [];

    for (const line of lines) {
      if (line.includes('"entity"<|>')) {
        const [, name, type, description] = line.split('<|>').map(s => s.replace(/[()"\s]/g, ''));
        entities.push({ 
          name, 
          type, 
          description,
          daemonPubkey,
          channelId 
        });
      } else if (line.includes('"relationship"<|>')) {
        const [, source, target, description, keywords, strength] = line.split('<|>').map(s => s.replace(/[()"\s]/g, ''));
        relationships.push({
          sourceEntity: source,
          targetEntity: target,
          description,
          keywords: keywords.split(',').map(k => k.trim()),
          strength: Number(strength)
        });
      } else if (line.includes('"content_keywords"<|>')) {
        contentKeywords = line.split('<|>')[1].replace(/[()"\s]/g, '').split(',').map(k => k.trim());
      }
    }

    return { entities, relationships, contentKeywords };
  }

  async insert(text: string, daemonPubkey: string, channelId?: string): Promise<void> {
    console.log("RAG - Inserting knowledge", text);
    const timestamp = Date.now();
    const id = nanoid();
    try {
      const [vector, extractedContent] = await Promise.all([
        this.getEmbedding(text),
        this.extractEntities(text, daemonPubkey, channelId)
      ]);
      console.log("Extracted content", extractedContent);

      // Create vector data
      const vectorData: VectorData = {
        id,
        text,
        vector,
        channelId,
        daemonPubkey,
        timestamp
      };

      // Create graph node for the text itself
      const textNode: GraphNode = {
        id,
        text,
        type: 'text',
        channelId,
        daemonPubkey,
        timestamp
      };

      // Create nodes and relationships for extracted entities
      const entityNodes: GraphNode[] = extractedContent.entities.map(entity => ({
        id: nanoid(),
        text: entity.name,
        type: entity.type,
        channelId,
        daemonPubkey,
        timestamp
      }));

      const entityRelations: GraphRelation[] = extractedContent.relationships.map(rel => ({
        sourceId: entityNodes.find(n => n.text === rel.sourceEntity)?.id || '',
        targetId: entityNodes.find(n => n.text === rel.targetEntity)?.id || '',
        type: rel.keywords.join(','),
        channelId,
        daemonPubkey
      })).filter(rel => rel.sourceId && rel.targetId);

      // Insert everything
      await Promise.all([
        this.postgres.insert(vectorData),
        this.neo4j.insertNode(textNode),
        ...entityNodes.map(node => this.neo4j.insertNode(node)),
        ...entityRelations.map(rel => this.neo4j.insertRelation(rel))
      ]);
    } catch (err) {
      console.error("RAG - Error inserting knowledge", err);
      throw err;
    }
  }

  async query(text: string, daemonPubkey: string, channelId?: string): Promise<Array<{text: string, score: number}>> {
    // Get vector for query text
    const queryVector = await this.getEmbedding(text);

    // Query both storages with filtering by daemonPubkey and channelId
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