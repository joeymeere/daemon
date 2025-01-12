import type {
  Character,
  IDaemon,
  ToolRegistration,
  ITool,
  IMessageLifecycle,
} from "./types";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "./SSEClientTransport.js";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import type { Keypair } from "@solana/web3.js";
import { generateEmbeddings, generateText } from "./llm.js";

export class Daemon implements IDaemon {
  id: string | undefined;
  character: Character | undefined;
  keypair: Keypair | undefined;
  modelApiKeys: {
    generationKey: string | undefined;
    embeddingKey: string | undefined;
  } = {
    generationKey: undefined,
    embeddingKey: undefined,
  };

  mcpClients: {
    [url: string]: {
      name: string;
      description: string;
      client: Client;
    };
  } = {};

  tools: {
    server: ToolRegistration[];
    context: ToolRegistration[];
    action: ToolRegistration[];
    postProcess: ToolRegistration[];
  } = {
    server: [],
    context: [],
    action: [],
    postProcess: [],
  };

  constructor() {}

  async init(opts: {
    id?: string;
    character?: Character;
    contextServerUrl: string;
    privateKey: Keypair;
    modelApiKeys: {
      generationKey: string;
      embeddingKey?: string;
    };
  }) {
    this.modelApiKeys = {
      generationKey: opts.modelApiKeys.generationKey,
      embeddingKey:
        opts.modelApiKeys.embeddingKey ?? opts.modelApiKeys.generationKey,
    };

    await this.addMCPServer({ url: opts.contextServerUrl });

    if (opts.character) {
      if (opts.character?.pubkey !== opts.privateKey.publicKey.toBase58()) {
        throw new Error("Private key does not match character pubkey");
      }
    }

    if (opts.id) {
      // If id, then fetch character from Context Server
      try {
        const result = await this.callTool(
          "fetchCharacter",
          opts.contextServerUrl,
          {
            id: opts.id,
          }
        );

        this.character = result as Character;
        this.keypair = opts.privateKey;
        this.id = opts.id;
      } catch (e) {
        throw new Error("Failed to fetch character");
      }
    } else if (opts.character) {
      // If character, then register character in Context Server
      try {
        const result = await this.callTool(
          "registerCharacter",
          opts.contextServerUrl,
          {
            ...opts.character,
          }
        );

        this.id = result.id;
        this.character = opts.character;
        this.keypair = opts.privateKey;
      } catch (e) {
        throw new Error("Failed to register character");
      }
    } else {
      throw new Error("No character or id provided");
    }
  }

  async addMCPServer(opts: { url: string }) {
    const client = new Client(
      {
        name: opts.url,
        version: "1.0.0",
      },
      { capabilities: {} }
    );

    await client.connect(new SSEClientTransport(new URL(opts.url)));

    // Server Info
    const serverInfoResult = (
      await client.callTool({ name: "getServerInfo", arguments: {} })
    ).content as TextContent[];

    if (serverInfoResult[0].text.includes("Error")) {
      throw new Error(serverInfoResult[0].text);
    }

    const serverInfo = JSON.parse(serverInfoResult[0].text) as {
      name: string;
      description: string;
    };

    // Server Tools
    const serverTools = (
      await client.callTool({ name: "listServerTools", arguments: {} })
    ).content as TextContent[];

    if (serverTools[0].text.includes("Error")) {
      throw new Error(serverTools[0].text);
    }

    const serverToolList = JSON.parse(serverTools[0].text) as ITool[];

    // Context Tools
    const contextTools = (
      await client.callTool({ name: "listContextTools", arguments: {} })
    ).content as TextContent[];

    const contextToolList = JSON.parse(contextTools[0].text) as ITool[];

    // Action Tools
    const actionTools = (
      await client.callTool({ name: "listActionTools", arguments: {} })
    ).content as TextContent[];
    const actionToolList = JSON.parse(actionTools[0].text) as ITool[];

    // Post Process Tools
    const postProcessTools = (
      await client.callTool({
        name: "listPostProcessTools",
        arguments: {},
      })
    ).content as TextContent[];
    const postProcessToolList = JSON.parse(postProcessTools[0].text) as ITool[];

    this.mcpClients[opts.url] = {
      name: serverInfo.name,
      description: serverInfo.description,
      client,
    };

    this.tools.server.push(
      ...serverToolList.map((serverTool) => {
        return {
          serverUrl: opts.url,
          tool: serverTool,
        };
      })
    );

    this.tools.context.push(
      ...contextToolList.map((contextTool) => {
        return {
          serverUrl: opts.url,
          tool: contextTool,
        };
      })
    );

    this.tools.action.push(
      ...actionToolList.map((actionTool) => {
        return {
          serverUrl: opts.url,
          tool: actionTool,
        };
      })
    );

    this.tools.postProcess.push(
      ...postProcessToolList.map((postProcessTool) => {
        return {
          serverUrl: opts.url,
          tool: postProcessTool,
        };
      })
    );
  }

  async removeMCPServer(opts: { url: string }): Promise<void> {
    delete this.mcpClients[opts.url];
    this.tools.server = this.tools.server.filter(
      (tool) => tool.serverUrl !== opts.url
    );
    this.tools.context = this.tools.context.filter(
      (tool) => tool.serverUrl !== opts.url
    );
    this.tools.action = this.tools.action.filter(
      (tool) => tool.serverUrl !== opts.url
    );
    this.tools.postProcess = this.tools.postProcess.filter(
      (tool) => tool.serverUrl !== opts.url
    );
  }

  private async callTool(
    toolName: string,
    toolURL: string,
    args: any
  ): Promise<any> {
    const client = this.mcpClients[toolURL].client;

    const result = (
      await client.callTool({
        name: toolName,
        arguments: args,
      })
    ).content as TextContent[];

    if (result[0].text.includes("Error")) {
      throw new Error(result[0].text);
    } else {
      return JSON.parse(result[0].text);
    }
  }

  async message(
    message: string,
    opts?: {
      channelId?: string;
      context?: boolean;
      actions?: boolean;
      postProcess?: boolean;
    }
  ): Promise<IMessageLifecycle> {
    const context = opts?.context ?? true;
    const actions = opts?.actions ?? true;
    const postProcess = opts?.postProcess ?? true;

    // Lifecycle: message -> fetchContext -> generateText -> takeActions -> postProcess
    let lifecycle: IMessageLifecycle = {
      message,
      channelId: opts?.channelId,
      systemPrompt: this.character?.systemPrompt,
      embedding: [],
      context: [],
      actions: [],
      postProcess: [],
    };

    // Generate Embeddings
    lifecycle = await generateEmbeddings(this, lifecycle);

    if (context) {
      for (const tool of this.tools.context) {
        const result = (await this.callTool(tool.tool.name, tool.serverUrl, {
          lifecycle: lifecycle,
        })) as IMessageLifecycle;
        lifecycle = result;
      }
    }

    // Generate Text
    lifecycle = await generateText(this, lifecycle);

    if (actions) {
      for (const tool of this.tools.action) {
        const result = (await this.callTool(tool.tool.name, tool.serverUrl, {
          lifecycle: lifecycle,
        })) as IMessageLifecycle;
        lifecycle = result;
      }
    }

    if (postProcess) {
      for (const tool of this.tools.postProcess) {
        const result = (await this.callTool(tool.tool.name, tool.serverUrl, {
          lifecycle: lifecycle,
        })) as IMessageLifecycle;
        lifecycle = result;
      }
    }

    return lifecycle;
  }
}
