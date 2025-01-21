import { EXTRACT_ENTITY_PROMPT, ZENTITY_EXTRACTED_TYPE, type AIConfig, type FalkorConfig, type GraphNode } from "./types";
import { FalkorDB } from "falkordb";
import { generateObject, embedMany } from "ai";
import { z } from "zod";
import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { nanoid } from "nanoid";

export class SimpleRAG {
    private dbConfig: FalkorConfig;
    private aiConfig: AIConfig;
    private falkor: FalkorDB | undefined;
    private openai: OpenAIProvider | undefined;

    constructor(aiConfig: AIConfig, dbConfig: FalkorConfig) {
        this.dbConfig = dbConfig;
        this.aiConfig = aiConfig;
        this.openai =  createOpenAI({
            baseURL: aiConfig.baseUrl ?? "https://api.openai.com/v1",
            apiKey: aiConfig.apiKey
        });
    }
    
    async init(): Promise<void> {
        this.falkor = await FalkorDB.connect({
            username: this.dbConfig.username || "default",
            password: this.dbConfig.password || "default",
            socket: {
                host: this.dbConfig.socket.host || "localhost",
                port: this.dbConfig.socket.port || 6379
            }
        });

        const graph = this.falkor.selectGraph(this.dbConfig.graph || "simple-rag");
        // Create constraints for unique IDs
        await graph.query(`CREATE CONSTRAINT ON (n:Entity) ASSERT n.id IS UNIQUE`);
        
        // Create vector indexes for entities and relationships
        await graph.query(`CREATE VECTOR INDEX FOR (n:Entity) ON (n.embedding)`);
        await graph.query(`CREATE VECTOR INDEX FOR ()-[r:RELATES_TO]->() ON (r.embedding)`);
        
        // Create indexes for timestamp and type fields for faster querying
        await graph.query(`CREATE INDEX FOR (n:Entity) ON (n.timestamp)`);
        await graph.query(`CREATE INDEX FOR (n:Entity) ON (n.type)`);
        await graph.query(`CREATE INDEX FOR ()-[r:RELATES_TO]->() ON (r.timestamp)`);
        await graph.query(`CREATE INDEX FOR ()-[r:RELATES_TO]->() ON (r.type)`);
    }

    async close(): Promise<void> {
        if (!this.falkor) {
            return;
        }
        await this.falkor.close();
    }

    async insert(text: string, daemonPubkey: string, channelId?: string): Promise<void> {
        try {
            if (!this.falkor) {
                throw new Error("FalkorDB is not initialized");
            }
    
            // Extract Entities from Text
            const entitiesAndRelationships = (await generateObject({
                prompt: `${EXTRACT_ENTITY_PROMPT}\nInput Text: ${text}`,
                model: this.openai!.languageModel(this.aiConfig.entityExtractionModel ?? "gpt-4o"),
                schema: ZENTITY_EXTRACTED_TYPE
            })).object;
    
            const SIMILARITY_THRESHOLD = 0.85; // Composite similarity threshold

            // Generate embeddings for all entities at once
            const entityEmbeddings = (await embedMany({
                model: this.openai!.textEmbeddingModel(this.aiConfig.embeddingModel ?? "text-embedding-3-small"),
                values: entitiesAndRelationships.entities.map((entity) => 
                    `${entity.name} | ${entity.type} | ${entity.description}`)
            })).embeddings as number[][];

            const graph = this.falkor.selectGraph(this.dbConfig.graph || "simple-rag");

            // Search for similar entities for all embeddings
            const similarEntitiesPromises = entityEmbeddings.map(entityEmbedding => 
                graph.query(`
                    CALL db.idx.vector.queryNodes('Entity', 'embedding', 5, vecf32($embedding))
                    YIELD node, score
                    WHERE score >= 0.7
                    RETURN node, score
                `, { params: { embedding: entityEmbedding} })
            );
            const similarEntitiesResults = await Promise.all(similarEntitiesPromises);

            // Process entities and their similar matches
            let entitiesWithIds = entitiesAndRelationships.entities.map((entity, index) => {
                const similarEntities = (similarEntitiesResults[index].data || []) as { node: GraphNode; score: number }[];
                const entityEmbedding = entityEmbeddings[index];


                // No Similar Entities, it's a new entity
                if(similarEntities.length == 0) {   
                    return {
                        ...entity, //name, type, description
                        id: nanoid(),
                        embedding: entityEmbedding,
                        channelId: channelId == undefined ? null : channelId,
                        daemonPubkey,
                        timestamp: Date.now()
                    }
                }

                // Similar entities were found, find if any match threshold
                // If none do, then the entity is the entity
                const bestMatch = similarEntities.reduce((best, currentNode) => {
                    const similarTypeScore = entity.type === currentNode.node.type ? 1 : 0;
                    const similarNameScore = entity.name.toLowerCase() === currentNode.node.name.toLowerCase() ? 1 : 
                                            entity.name.toLowerCase().includes(currentNode.node.name.toLowerCase()) || 
                                            currentNode.node.name.toLowerCase().includes(entity.name.toLowerCase()) ? 0.8 : 0;
                    
                    const compositeScore = (
                        currentNode.score * 0.3 + // 30% weight for embedding similarity
                        similarTypeScore * 0.25 + // 25% weight for type match
                        similarNameScore * 0.45 // 45% weight for name similarity
                    );

                    if(compositeScore > best.score) return currentNode;
                    else return best;

                }, {node: {
                    ...entity,
                    id: nanoid(),
                    embedding: entityEmbedding,
                    channelId: channelId == undefined ? null : channelId,
                    daemonPubkey,
                    timestamp: Date.now()
                }, score: 1});


                // If we found a good match, use it; otherwise create new entity
                if (bestMatch && bestMatch.score >= SIMILARITY_THRESHOLD) {
                    return {
                        id: bestMatch.node.id,
                        ...entity,
                        embedding: bestMatch.node.embedding
                    };
                } else {
                    return {
                        id: nanoid(),
                        ...entity,
                        embedding: entityEmbedding
                    };
                }
            });


            let relationshipsWithIds = entitiesAndRelationships.relationships.map((relationship) => {
                let sourceId = entitiesWithIds.find((entity) => entity.name === relationship.source)?.id;
                let targetId = entitiesWithIds.find((entity) => entity.name === relationship.target)?.id;
                return {
                    id: nanoid(),
                    sourceId: sourceId,
                    targetId: targetId,
                    ...relationship
                }
            });

            // Get embeddings for relationships
            let relationshipEmbeddings = await embedMany({
                model: this.openai!.textEmbeddingModel(this.aiConfig.embeddingModel ?? "text-embedding-3-small"),
                values: relationshipsWithIds.map((relationship) => 
                    `${relationship.source} | ${relationship.target} | ${relationship.type} | ${relationship.description}`)  
            });

            const relationshipsWithIdAndEmbeddings = relationshipsWithIds.map((relationship, index) => {
                return {
                    ...relationship,
                    embedding: relationshipEmbeddings.values[index]
                }
            });

            // Insert entitiesWithIds and relationshipsWithIds into the graph
            // First, merge or create entities
            let entityInsertPromises = entitiesWithIds.map((entity) => {
                return graph.query(`
                    MERGE (e:Entity {id: $id})
                    ON CREATE SET 
                        e.name = $name,
                        e.type = $type,
                        e.description = $description,
                        e.embedding = $embedding,
                        e.channelId = $channelId,
                        e.daemonPubkey = $daemonPubkey,
                        e.timestamp = $timestamp
                    `, { params: {
                        id: entity.id,
                        name: entity.name,
                        type: entity.type,
                        description: entity.description,
                        embedding: entity.embedding,
                        channelId: channelId == undefined ? null : channelId,
                        daemonPubkey: daemonPubkey,
                        timestamp: Date.now()
                    }})
            });

            let relationshipInsertPromises = relationshipsWithIdAndEmbeddings.map((relationship) => {
                return graph.query(`
                    MERGE (e:Entity {id: $id})
                    ON CREATE SET 
                        e.name = $name,
                        e.type = $type,
                        e.description = $description,
                        e.embedding = $embedding,
                        e.channelId = $channelId,
                        e.daemonPubkey = $daemonPubkey,
                        e.timestamp = $timestamp
                    `, { params: {
                        id: relationship.id,
                        name: relationship.source,
                        type: relationship.type,
                        description: relationship.description,
                        embedding: relationship.embedding,
                        channelId: channelId == undefined ? null : channelId,
                        daemonPubkey: daemonPubkey,
                        timestamp: Date.now()    
                    }});
            });

            await Promise.all([entityInsertPromises, relationshipInsertPromises]);

        } catch (error) {    
            // LOG ERROR
            console.log("SimpleRAG ERROR: ", error);
            throw error;
        }

    }

    async query(text: string, daemonPubkey: string, channelId?: string): Promise<Array<{text: string, score: number}>> {
        try {
            if (!this.falkor) {
                throw new Error("FalkorDB is not initialized");
            }

            // Extract Entities from Text, find similar entities in the graph and relationships related to them


            return [];
        } catch (error) {    
            // LOG ERROR
            console.log("SimpleRAG ERROR: ", error);
            throw error;
        }
    }
}