import { ZMessageLifecycle, type IDaemonMCPServer, type IMessageLifecycle, type ITool } from "@spacemangaming/daemon";
import { SimpleRAG } from "./SimpleRAG/SimpleRAG";
import { LiteMCP } from "litemcp";
import { z } from "zod";
import type { AIConfig, FalkorConfig } from "./SimpleRAG/types";

export class MemoryServer implements IDaemonMCPServer {
    name: string;
    private server: LiteMCP;
    simpleRag: SimpleRAG | undefined;
    
    constructor(opts: { name: string }) {
        this.name = opts.name;
        this.server = new LiteMCP(this.name, "1.0.0");
    }
    
    async init(aiConfig: AIConfig, dbConfig: FalkorConfig): Promise<void> {
        try {
            this.simpleRag = new SimpleRAG(aiConfig, dbConfig);
            await this.simpleRag.init();
        } catch (error) {
            console.error("Failed to initialize Memory Server: ", error)
            throw error;
        }
    }
    
    async stop(): Promise<void> {
        if(!this.simpleRag) {      
            return;
        }
        await this.simpleRag?.close();
    }
    
    async start(port?: number): Promise<void> {
        if(!this.simpleRag) {
            return;
        }
        // Server Info
        this.server.addTool({
            name: "getServerInfo",
            description: "Get server info",
            parameters: z.object({}),
            execute: async (): Promise<{ name: string; description: string }> => {
                return {
                    name: "Daemon Memory Server",
                    description: "Memory Server for Daemon Framework using LightRAG (hybrid vector and graph memory)",
                };
            },
        });
        
        // List Tools
        this.server.addTool({
            name: "listServerTools",
            description: "List server tools",
            parameters: z.object({}),
            execute: async (): Promise<ITool[]> => {
                return [];
            },
        });
        
        this.server.addTool({
            name: "listContextTools",
            description: "List context tools",
            parameters: z.object({}),
            execute: async (): Promise<ITool[]> => {
                return [
                    {
                        name: "ctx_getContext",
                        description: "Get context for a message",
                        type: "Context",
                        zIndex: 0,
                    }
                ];
            },
        });
        
        this.server.addTool({
            name: "listActionTools",
            description: "List action tools",
            parameters: z.object({}),
            execute: async (): Promise<ITool[]> => {
                return [];
            },
        });
        
        this.server.addTool({
            name: "listPostProcessTools",
            description: "List post process tools",
            parameters: z.object({}),
            execute: async (): Promise<ITool[]> => {
                return [
                    {
                        name: "pp_createKnowledge",
                        description: "Create a knowledge",
                        type: "PostProcess",
                        zIndex: 1000,
                    }
                ];
            },
        });
        
        // Server Tools
        // Context Tools
        this.server.addTool({
            name: "ctx_getContext",
            description: "Get context for a message",
            parameters: z.object({
                lifecycle: ZMessageLifecycle,
                args: z.any(),
            }),
            execute: async (args: {lifecycle: IMessageLifecycle, args?: any}) => {
                return await this.getContextFromQuery(args.lifecycle);
            },
        });
        // Action Tools
        // Post Process Tools
        this.server.addTool({
            name: "pp_createKnowledge",
            description: "Create a knowledge",
            parameters: z.object({
                lifecycle: ZMessageLifecycle,
                args: z.any(),
            }),
            execute: async (args: {lifecycle: IMessageLifecycle, args?: any}) => {
                return await this.insertKnowledge(args.lifecycle);
            },
        });

        // Start Server
        this.server.start({
            transportType: "sse",
            sse: {
                endpoint: "/sse",
                port: port || 8002
            }
        });
    }

    private async getContextFromQuery(lifecycle: IMessageLifecycle): Promise<IMessageLifecycle> {
        try {
            if(!this.simpleRag) {
                return lifecycle;
            }
            const contextResults = (await this.simpleRag.query(lifecycle.message, lifecycle.daemonPubkey, lifecycle.channelId ?? undefined)).slice(0, 20);
            lifecycle.context.push(`\n# Entities Found In Previous Memory\n${contextResults.join("\n")}`);
            return lifecycle;
        } catch (error) {
            // LOG ERROR
            return lifecycle;       
        }
    }

    private async insertKnowledge(lifecycle: IMessageLifecycle): Promise<IMessageLifecycle> {
        try {
            if(!this.simpleRag) {
                return lifecycle;
            }
            
            const msgToInsert = `
# User Message
${lifecycle.message}

# Agent Reply
${lifecycle.output}            
            `
            await this.simpleRag.insert(msgToInsert, lifecycle.daemonPubkey, lifecycle.channelId ?? undefined);
            lifecycle.postProcessLog.push(
                JSON.stringify({
                    server: this.name,
                    tool: "pp_createKnowledge",
                    args: {
                        message: lifecycle.message,
                        output: lifecycle.output,
                    },
                })
            );
            return lifecycle;
        } catch (error) {
            // LOG ERROR
            return lifecycle;
        }
    }
}
