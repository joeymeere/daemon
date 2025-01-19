import { ZMessageLifecycle, type IDaemonMCPServer, type IMessageLifecycle, type ITool } from "@spacemangaming/daemon";
import { LightRAG } from "./LightRAG/LightRAG";
import type { StorageConfig } from "./LightRAG/types";
import { LiteMCP } from "litemcp";
import { z } from "zod";

export class MemoryServer implements IDaemonMCPServer {
    name: string;
    private server: LiteMCP;
    lrag: LightRAG | undefined;
    
    constructor(opts: { name: string }) {
        this.name = opts.name;
        this.server = new LiteMCP(this.name, "1.0.0");
    }
    
    async init(config: StorageConfig): Promise<void> {
        this.lrag = new LightRAG(config);
    }
    
    async stop(): Promise<void> {
        if(!this.lrag) {      
            return;
        }
        await this.lrag?.close();
    }
    
    async start(port?: number): Promise<void> {
        if(!this.lrag) {
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
            parameters: ZMessageLifecycle,
            execute: async (lifecycle: IMessageLifecycle) => {
                return await this.getContextFromQuery(lifecycle);
            },
        });
        // Action Tools
        // Post Process Tools
        this.server.addTool({
            name: "pp_createKnowledge",
            description: "Create a knowledge",
            parameters: ZMessageLifecycle,
            execute: async (lifecycle: IMessageLifecycle) => {
                return await this.insertKnowledge(lifecycle);
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
            if(!this.lrag) {
                return lifecycle;
            }
            const contextResults = await this.lrag.query(lifecycle.message, lifecycle.daemonPubkey, lifecycle.channelId ?? undefined);
            lifecycle.context.push(`\n# Additional Context\n${contextResults.map((result) => result.text).join("\n")}`);
            return lifecycle;
        } catch (error) {
            // LOG ERROR
            return lifecycle;       
        }
    }

    private async insertKnowledge(lifecycle: IMessageLifecycle): Promise<IMessageLifecycle> {
        try {
            if(!this.lrag) {
                return lifecycle;
            }
            
            const msgToInsert = `
            # User Message
            ${lifecycle.message}
            
            # Agent Reply
            ${lifecycle.output}            
            `
            
            await this.lrag.insert(msgToInsert, lifecycle.daemonPubkey, lifecycle.channelId ?? undefined);
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
