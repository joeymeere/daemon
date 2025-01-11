import { nanoid } from "nanoid";
import type { Character, IDaemon } from "./types";

export class Daemon implements IDaemon {
  id: string;
  character: Character;
  contextServer: string;

  constructor(opts: {
    id?: string;
    character?: Character;
    contextServer: string;
  }) {
    this.id = opts.id ?? nanoid();
    this.contextServer = opts.contextServer;

    if (opts.character) {
      this.character = opts.character;
      // Initalize Character in Context Server
    } else if (opts.id) {
      // Fetch Character from Context Server
    } else {
      throw new Error("Either character or id must be defined!");
    }
  }
}
