# @spacemangaming/daemon

[Documentation](https://daemon.spacemangaming.com)

A TypeScript framework for creating AI agents that can interact with Model Context Protocol (MCP) servers. This package provides a robust system for message processing, tool management, and lifecycle events.

## Installation

```bash
bun add @spacemangaming/daemon
```

## Quick Start

```typescript
import { Daemon } from "@spacemangaming/daemon";
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();

const character = {
    name: "John Doe",
    pubkey: keypair.publicKey.toBase58(),
    identityPrompt: "You are a helpful assistant.",
};

const daemon = new Daemon(character, keypair);
const daemon.addModelProvider({
    openai: {
        endpoint: "https://api.openai.com/v1",
        models: ["gpt-4o-mini"],
        apiKey: "your-openai-api-key",
    },
});
const response = await daemon.message("Hello! How are you doing today?");
```

## Key Features

-   **Message Lifecycle Management**: Structured processing of messages through context gathering, LLM interactions, and actions
-   **Tool System**: Flexible integration with MCP servers for extended functionality
-   **Security**: Built-in message signing and cryptographic approval chains
-   **Character System**: Define agent personalities and behaviors through structured configurations

## Core Components

-   **Daemon Class**: Main class implementing the agent functionality
-   **Message Processing**: Handles the complete lifecycle of message processing
-   **MCP Server Integration**: Connect to and utilize tools from MCP servers
-   **Character Configuration**: Define agent identity and behavior

## Documentation

For detailed technical documentation, please see:

-   [Technical Documentation](/docs/packages/daemon.md)
-   [API Reference](https://github.com/SpacemanGaming/Daemon/blob/main/packages/daemon/src/types.ts)

## License

MIT
