import { EXTRACT_ENTITY_AND_RELATIONSHIP_PROMPT, EXTRACT_ENTITY_ONLY_PROMPT, ZENTITY_EXTRACTED_TYPE, ZExtractedEntity, type AIConfig, type FalkorConfig, type GraphNode, type GraphRelation } from "./types";
import { FalkorDB } from "falkordb";
import { generateObject, embedMany, generateText } from "ai";
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
                prompt: `${EXTRACT_ENTITY_AND_RELATIONSHIP_PROMPT}\nInput Text: ${text}`,
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
                    AND node.daemonPubkey = $daemonPubkey
                    ${channelId ? 'AND node.channelId = $channelId' : ''}
                    RETURN node, score
                `, { params: { 
                    embedding: entityEmbedding,
                    daemonPubkey: daemonPubkey,
                    ...(channelId ? { channelId } : {})
                }})
            );
            const similarEntitiesResults = await Promise.all(similarEntitiesPromises);

            // Process entities and their similar matches
            const entitiesWithIds = await Promise.all(entitiesAndRelationships.entities.map(async (entity, index) => {
                const similarEntities = (similarEntitiesResults[index].data || []) as { node: GraphNode; score: number }[];
                const entityEmbedding = entityEmbeddings[index];

                // No Similar Entities, it's a new entity
                if(similarEntities.length == 0) {   
                    return {
                        ...entity,
                        id: nanoid(),
                        embedding: entityEmbedding,
                        channelId: channelId == undefined ? null : channelId,
                        daemonPubkey,
                        timestamp: Date.now()
                    }
                }

                // Similar entities were found, find if any match threshold
                const bestMatch = similarEntities.reduce((best, currentNode) => {
                    const similarTypeScore = entity.type === currentNode.node.type ? 1 : 0;
                    const similarNameScore = entity.name.toLowerCase() === currentNode.node.name.toLowerCase() ? 1 : 
                                            entity.name.toLowerCase().includes(currentNode.node.name.toLowerCase()) || 
                                            currentNode.node.name.toLowerCase().includes(entity.name.toLowerCase()) ? 0.8 : 0;
                    
                    const compositeScore = (
                        currentNode.score * 0.3 + 
                        similarTypeScore * 0.25 + 
                        similarNameScore * 0.45 
                    );

                    return compositeScore > best.score ? currentNode : best;
                }, {
                    node: {
                        ...entity,
                        id: nanoid(),
                        embedding: entityEmbedding,
                        channelId: channelId == undefined ? null : channelId,
                        daemonPubkey,
                        timestamp: Date.now()
                    }, 
                    score: 0
                });

                // If we found a good match, combine descriptions and generate new embedding
                if (bestMatch && bestMatch.score >= SIMILARITY_THRESHOLD) {
                    let combinedDescription = `${bestMatch.node.description}. ${entity.description}`;

                    // If combined description is too long, send a call to AI to summarize it.
                    if(combinedDescription.length > 1024) {
                        combinedDescription = (await generateText({
                            prompt: `Summarize the following text into fewer than 512 characters: ${combinedDescription}`,
                            model: this.openai!.languageModel(this.aiConfig.entityExtractionModel ?? "gpt-4o")
                        })).text;
                    }
                    
                    // Generate new embedding for combined description
                    const newEmbedding = (await embedMany({
                        model: this.openai!.textEmbeddingModel(this.aiConfig.embeddingModel ?? "text-embedding-3-small"),
                        values: [`${entity.name} | ${entity.type} | ${combinedDescription}`]
                    })).embeddings[0];

                    return {
                        id: bestMatch.node.id,
                        name: entity.name,
                        type: entity.type,
                        description: combinedDescription,
                        embedding: newEmbedding,
                        channelId: channelId == undefined ? null : channelId,
                        daemonPubkey,
                        timestamp: Date.now()
                    };
                } else {
                    return {
                        id: nanoid(),
                        ...entity,
                        embedding: entityEmbedding,
                        channelId: channelId == undefined ? null : channelId,
                        daemonPubkey,
                        timestamp: Date.now()
                    };
                }
            }));

            let relationshipsWithIds = entitiesAndRelationships.relationships.map((relationship) => {
                // TODO possibly will fail if the entity names are slightly different in the existing db and new text but match similarity is there
                let sourceId = entitiesWithIds.find((entity) => entity.name === relationship.source)!.id;
                let targetId = entitiesWithIds.find((entity) => entity.name === relationship.target)!.id;
                return {
                    id: nanoid(),
                    sourceId: sourceId,
                    targetId: targetId,
                    ...relationship
                }
            });

            // Get embeddings for relationships in parallel
            const relationshipEmbeddings = await embedMany({
                model: this.openai!.textEmbeddingModel(this.aiConfig.embeddingModel ?? "text-embedding-3-small"),
                values: relationshipsWithIds.map((relationship) => 
                    `${relationship.source} | ${relationship.target} | ${relationship.type} | ${relationship.description}`)  
            });

            const relationshipsWithIdAndEmbeddings = relationshipsWithIds.map((relationship, index) => ({
                ...relationship,
                embedding: relationshipEmbeddings.values[index]
            }));

            // Insert entities and relationships in parallel
            const [entityResults, relationshipResults] = await Promise.all([
                Promise.all(entitiesWithIds.map(entity => 
                    graph.query(`
                        MERGE (e:Entity {id: $id})
                        SET 
                            e.name = $name,
                            e.type = $type,
                            e.description = $description,
                            e.embedding = $embedding,
                            e.channelId = $channelId,
                            e.daemonPubkey = $daemonPubkey,
                            e.timestamp = $timestamp
                    `, { 
                        params: {
                            id: entity.id,
                            name: entity.name,
                            type: entity.type,
                            description: entity.description,
                            embedding: entity.embedding,
                            channelId: entity.channelId,
                            daemonPubkey: entity.daemonPubkey,
                            timestamp: entity.timestamp
                        }
                    })
                )),
                Promise.all(relationshipsWithIdAndEmbeddings.map(relationship =>
                    graph.query(`
                        MATCH (source:Entity {id: $sourceId})
                        MATCH (target:Entity {id: $targetId})
                        MERGE (source)-[r:RELATES {id: $id}]->(target)
                        SET 
                            r.type = $type,
                            r.embedding = $embedding,
                            r.channelId = $channelId,
                            r.daemonPubkey = $daemonPubkey,
                            r.timestamp = $timestamp
                    `, {
                        params: {
                            id: relationship.id,
                            sourceId: relationship.sourceId,
                            targetId: relationship.targetId,
                            type: relationship.type,
                            embedding: relationship.embedding,
                            channelId: channelId == undefined ? null : channelId,
                            daemonPubkey: daemonPubkey,
                            timestamp: Date.now()
                        }
                    })
                ))
            ]);

        } catch (error) {    
            console.log("SimpleRAG ERROR: ", error);
            throw error;
        }
    }

    async query(text: string, daemonPubkey: string, channelId?: string): Promise<Array<{text: string, score: number}>> {
        try {
            if (!this.falkor) {
                throw new Error("FalkorDB is not initialized");
            }

            // Extract entities from Text
            const extractedEntities = (await generateObject({
                prompt: `${EXTRACT_ENTITY_ONLY_PROMPT}\nInput Text: ${text}`,
                model: this.openai!.languageModel(this.aiConfig.entityExtractionModel ?? "gpt-4o"),
                schema: z.array(ZExtractedEntity)
            })).object;

            // Generate embeddings for extracted entities
            const entityEmbeddings = (await embedMany({
                model: this.openai!.textEmbeddingModel(this.aiConfig.embeddingModel ?? "text-embedding-3-small"),
                values: extractedEntities.map((entity) => 
                    `${entity.name} | ${entity.type} | ${entity.description}`)
            })).embeddings as number[][];

            const graph = this.falkor.selectGraph(this.dbConfig.graph || "simple-rag");
            const SIMILARITY_THRESHOLD = 0.85;

            // Find similar entities and their relationships
            const results: Array<{text: string, score: number}> = [];
            
            // Process all entities in parallel
            const entityPromises = extractedEntities.map(async (entity, i) => {
                const embedding = entityEmbeddings[i];

                // Find similar entities
                const similarEntities = await graph.query(`
                    CALL db.idx.vector.queryNodes('Entity', 'embedding', 5, vecf32($embedding))
                    YIELD node, score
                    WHERE score >= 0.7
                    AND node.daemonPubkey = $daemonPubkey
                    ${channelId ? 'AND node.channelId = $channelId' : ''}
                    RETURN node, score
                    ORDER BY score DESC
                `, { 
                    params: { 
                        embedding,
                        daemonPubkey,
                        ...(channelId ? { channelId } : {})
                    }
                });

                // Process similar entities and get their relationships in parallel
                const entityResults = await Promise.all(((similarEntities.data || []) as Array<{ node: any, score: number }>).map(async (match) => {
                    const node = match.node as unknown as GraphNode;
                    const similarTypeScore = entity.type === node.type ? 1 : 0;
                    const similarNameScore = entity.name.toLowerCase() === node.name.toLowerCase() ? 1 : 
                                        entity.name.toLowerCase().includes(node.name.toLowerCase()) || 
                                        node.name.toLowerCase().includes(entity.name.toLowerCase()) ? 0.8 : 0;
                    
                    const compositeScore = (
                        match.score * 0.3 + 
                        similarTypeScore * 0.25 + 
                        similarNameScore * 0.45 
                    );

                    if (compositeScore >= SIMILARITY_THRESHOLD) {
                        // Get entity result and relationships in parallel
                        const [entityResult, relationships] = await Promise.all([
                            Promise.resolve({
                                text: `Found entity: ${node.name} (${node.type}) - ${node.description}`,
                                score: compositeScore
                            }),
                            graph.query(`
                                MATCH (e:Entity {id: $nodeId})-[r:RELATES]-(related:Entity)
                                WHERE related.daemonPubkey = $daemonPubkey
                                ${channelId ? 'AND related.channelId = $channelId' : ''}
                                RETURN e, r, related
                            `, {
                                params: {
                                    nodeId: node.id,
                                    daemonPubkey,
                                    ...(channelId ? { channelId } : {})
                                }
                            })
                        ]);

                        // Process relationships
                        const relationshipResults = (relationships.data || []).map((rel) => {
                            const source = rel as unknown as { e: GraphNode, r: GraphRelation, related: GraphNode };
                            const sourceNode = source.e;
                            const targetNode = source.related;
                            const relationship = source.r;

                            return {
                                text: `${sourceNode.name} ${relationship.type} ${targetNode.name}`,
                                score: compositeScore * 0.9 // Slightly lower confidence for relationships
                            };
                        });

                        return [entityResult, ...relationshipResults];
                    }
                    return [];
                }));

                return entityResults.flat().filter(Boolean);
            });

            // Wait for all entity processing to complete and flatten results
            const allResults = (await Promise.all(entityPromises)).flat();

            // Sort by score descending and return unique results
            return allResults
                .sort((a, b) => b.score - a.score)
                .filter((result, index, self) => 
                    index === self.findIndex(r => r.text === result.text)
                );

        } catch (error) {    
            console.log("SimpleRAG ERROR: ", error);
            throw error;
        }
    }
}