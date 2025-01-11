import type { Character, IDaemon } from "./types";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "./SSEClientTransport.js";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";

export class Daemon implements IDaemon {
  id: string | undefined;
  character: Character | undefined;
  pubkey: string | undefined;
  mcpClients: {
    [key: string]: {
      url: string;
      client: Client;
    };
  } = {};

  constructor(contextServerUrl: string) {
    this.mcpClients["default"] = {
      url: contextServerUrl,
      client: new Client(
        {
          name: "default",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      ),
    };
  }

  async init(opts: { id?: string; character?: Character }) {
    // Connect to Default MCP Client
    await this.mcpClients["default"].client.connect(
      new SSEClientTransport(new URL(this.mcpClients["default"].url))
    );

    if (opts.id) {
      // If id, then fetch character from Context Server
      const result = (
        await this.mcpClients["default"].client.callTool({
          name: "fetchCharacter",
          arguments: {
            id: opts.id,
          },
        })
      ).content as TextContent[];

      if (result[0].text.includes("Error")) {
        throw new Error(result[0].text);
      } else if (result[0].text == "{}") {
        throw new Error("Character not found");
      } else {
        this.character = JSON.parse(result[0].text) as Character;
        this.pubkey = this.character.pubkey;
        this.id = opts.id;
      }
    } else if (opts.character) {
      // If character, then register character in Context Server
      const result = (
        await this.mcpClients["default"].client.callTool({
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
        this.pubkey = opts.character.pubkey;
      }
    } else {
      throw new Error("No character or id provided");
    }
  }
}
