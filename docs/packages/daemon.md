# Overview
The daemon package provides a framework for creating AI agents that can interact with Model Context Protocol (MCP) servers. It handles message processing, tool management, and lifecycle events for AI-powered daemons.

## Installation
```bash
bun add @spacemangaming/daemon
```

## Core Components

### Daemon Class
The main class that implements the `IDaemon` interface.

#### Key Methods

##### `constructor()`
Creates an empty Daemon instance. Must call `init()` to configure it.

##### `init(identityServerUrl: string, opts: InitOptions)`
Initializes the daemon with:
- Identity server connection
- Character registration/fetching
- Model API keys setup
- Bootstrap server connections

##### `addMCPServer(opts: { url: string })`
Adds a new MCP server and indexes its tools into categories:
- Server Tools
- Context Tools
- Action Tools
- Post Process Tools

##### `message(message: string, opts?: MessageOptions)`
Processes messages through the lifecycle:
1. Context gathering
2. LLM prompt generation
3. Action execution
4. Post-processing

### Message Lifecycle
Each message goes through a structured lifecycle:

```typescript
interface IMessageLifecycle {
	daemonPubkey: string;      // Daemon's identifier
	message: string;           // Input message
	messageId: string;         // Unique message ID
	createdAt: string;        // Timestamp
	approval: string;         // Cryptographic signature
	channelId: string | null; // Optional context grouping
	daemonName: string;       // Daemon's name
	identityPrompt: string;   // Character definition
	context: string[];        // Gathered context
	tools: string[];          // Available tools
	generatedPrompt: string;  // Final LLM prompt
	output: string;          // LLM response
	hooks: IHook[];          // Pending operations
	hooksLog: string[];      // Hook results
	actionsLog: string[];    // Action results
	postProcessLog: string[]; // Post-process results
}
```

### Character Configuration
Characters define daemon identity and behavior:

```typescript
interface Character {
	name: string;
	pubkey: string;
	modelSettings: {
		generation: ModelSettings;
		embedding: ModelSettings;
	};
	identityPrompt: string;
	identityServerUrl: string;
	bootstrap: BootstrapConfig[];
}
```

### MCP Server Integration
Servers must implement the `IDaemonMCPServer` interface with required tool endpoints:
- `getServerInfo()`
- `listServerTools()`
- `listContextTools()`
- `listActionTools()`
- `listPostProcessTools()`

## Security Features
- Message signing using Solana keypairs
- Cryptographic approval chains
- Server authentication

## Best Practices
1. Always initialize daemons with proper character configurations
2. Handle message lifecycle events appropriately
3. Implement proper error handling for server communications
4. Use appropriate model settings for different tasks
5. Manage API keys securely

## Example Usage

```typescript
import { Daemon } from '@spacemangaming/daemon';
import { Keypair } from '@solana/web3.js';

const daemon = new Daemon();
await daemon.init('https://identity-server.example.com', {
	privateKey: Keypair.generate(),
	modelApiKeys: {
		generationKey: 'your-llm-api-key',
		embeddingKey: 'your-embedding-api-key'
	}
});

const response = await daemon.message('Hello, how can you help me?');
```