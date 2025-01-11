export interface IDaemon {
  // Properties
  id: string;
  character?: Character;
  // Private Key maintained by whatever instantianted the Daemon
  // Used to update memories
  pubkey: string;
}

export type Character = {
  name: string;
  bio: string[];
  lore: string[];
  pubkey: string;
  contextServer: string;
};

export interface IMemory {
  id: string;
  daemonId: string;
  // Optionally scoped to just a private conversation between human and daemon
  channelId: string | null;
  createdAt: Date;
  content: string;
  // Daemon feeds in the embedding so different Daemons can use different embedding models
  embedding: number[];
  // List of logs that contributed to this memory
  originationLogIds: string[];
}

export interface ILog {
  id?: string;
  daemonId: string;
  // Optionally scoped to just a private conversation between human and daemon
  channelId: string | null;
  createdAt?: Date;
  content: string;
  logType: "input" | "output";
}

export interface Approval {
  signature: string; //b64 signature of the hash
}

export interface IContextServer {
  init(): Promise<void>;
  start(): Promise<void>;

  // Register New Character (returns characterId)
  registerCharacter(character: Character): Promise<string>;
  // Fetch Character File
  fetchCharacter(characterId: string): Promise<Character | undefined>;
  // Insert Log
  createLog(log: ILog, approval: Approval): Promise<void>;
  // Fetch Logs
  fetchLogs(opts: {
    daemonId: string;
    channelId?: string;
    limit?: number; // Default 100
    orderBy?: "asc" | "desc"; // Default desc
  }): Promise<ILog[]>;
  // Fetch MemoryContext (optionally takes in channelId)
  fetchMemoryContext(opts: {
    daemonId: string;
    messageEmbedding: number[];
    limit: number; // Default 10
    channelId?: string; // Will include Common Memories and Channel Memories
  }): Promise<IMemory[]>;
  // Create Memory (optionally takes in channelId)
  createMemory(
    opts: {
      daemonId: string;
      message: string;
      messageEmbedding: number[];
      channelId?: string; // Will include Common Memories and Channel Memories
    },
    approval: Approval
  ): Promise<string>; // Returns memoryId
}
