import { type IDaemonMCPServer } from "@spacemangaming/daemon";
import { LightRAG } from "./LightRAG/LightRAG";
import type { StorageConfig } from "./LightRAG/types";
import { LiteMCP } from "litemcp";
import { z } from "zod";

export class MemoryServer implements IDaemonMCPServer {
    name: string;
    openAIKey: string;
    private server: LiteMCP;
    lrag: LightRAG | undefined;
    
    constructor(opts: { name: string; openAIKey: string }) {
        this.name = opts.name;
        this.openAIKey = opts.openAIKey;
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
            execute: async () => {
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
            execute: async () => {
                return [];
            },
        });
        
        this.server.addTool({
            name: "listContextTools",
            description: "List context tools",
            parameters: z.object({}),
            execute: async () => {
                return [];
            },
        });
        
        this.server.addTool({
            name: "listActionTools",
            description: "List action tools",
            parameters: z.object({}),
            execute: async () => {
                return [];
            },
        });
        
        this.server.addTool({
            name: "listPostProcessTools",
            description: "List post process tools",
            parameters: z.object({}),
            execute: async () => {
                return [];
            },
        });
        
        // Server Tools
        // Context Tools
        // Action Tools
        // Post Process Tools


        // Start Server
        this.server.start({
            transportType: "sse",
            sse: {
                endpoint: "/sse",
                port: port || 8002
            }
        });
    }
}
