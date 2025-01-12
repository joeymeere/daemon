import type { Character, IDaemon, ToolRegistration, Tool } from "./types";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "./SSEClientTransport.js";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import type { Keypair } from "@solana/web3.js";

export class Daemon implements IDaemon {
  id: string | undefined;
  character: Character | undefined;
  keypair: Keypair | undefined;
  modelApiKeys: {
    generationKey: string | undefined;
    decisionKey: string | undefined;
    embeddingKey: string | undefined;
  } = {
    generationKey: undefined,
    decisionKey: undefined,
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
      decisionKey: string;
      embeddingKey: string;
    };
  }) {
    this.modelApiKeys = opts.modelApiKeys;
    await this.addMCPServer({ url: opts.contextServerUrl });

    if (opts.id) {
      // If id, then fetch character from Context Server
      try {
        const serverUrl = this.tools.server.find(
          (tool) => tool.tool.name === "fetchCharacter"
        )?.serverUrl;

        if (!serverUrl) {
          throw new Error("No server url found");
        }

        const client = this.mcpClients[serverUrl].client;

        const result = (
          await client.callTool({
            name: "fetchCharacter",
            arguments: {
              id: opts.id,
            },
          })
        ).content as TextContent[];

        if (result[0].text.includes("Error")) {
          throw new Error(result[0].text);
        } else {
          this.character = JSON.parse(result[0].text) as Character;
          this.keypair = opts.privateKey;
          this.id = opts.id;
        }
      } catch (e) {
        throw new Error("Failed to fetch character");
      }
    } else if (opts.character) {
      // If character, then register character in Context Server
      try {
        const serverUrl = this.tools.server.find(
          (tool) => tool.tool.name === "registerCharacter"
        )?.serverUrl;

        if (!serverUrl) {
          throw new Error("No server url found");
        }

        const client = this.mcpClients[serverUrl].client;

        const result = (
          await client.callTool({
            name: "registerCharacter",
            arguments: {
              ...opts.character,
            },
          })
        ).content as TextContent[];

        if (result[0].text.includes("Error")) {
          throw new Error(result[0].text);
        } else {
          this.id = result[0].text;
          this.character = opts.character;
          this.keypair = opts.privateKey;
        }
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
    const serverInfoResult = (await client.callTool({ name: "getServerInfo" }))
      .content as TextContent[];

    if (serverInfoResult[0].text.includes("Error")) {
      throw new Error(serverInfoResult[0].text);
    }

    const serverInfo = JSON.parse(serverInfoResult[0].text) as {
      name: string;
      description: string;
    };

    // Server Tools
    const serverTools = (await client.callTool({ name: "listServerTools" }))
      .content as TextContent[];

    if (serverTools[0].text.includes("Error")) {
      throw new Error(serverTools[0].text);
    }

    const serverToolList = JSON.parse(serverTools[0].text) as Tool[];

    // Context Tools
    const contextTools = (await client.callTool({ name: "listContextTools" }))
      .content as TextContent[];

    const contextToolList = JSON.parse(contextTools[0].text) as Tool[];

    // Action Tools
    const actionTools = (await client.callTool({ name: "listActionTools" }))
      .content as TextContent[];
    const actionToolList = JSON.parse(actionTools[0].text) as Tool[];

    // Post Process Tools
    const postProcessTools = (
      await client.callTool({ name: "listPostProcessTools" })
    ).content as TextContent[];
    const postProcessToolList = JSON.parse(postProcessTools[0].text) as Tool[];

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
}
