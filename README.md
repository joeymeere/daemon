# Daemon 🕹

![Daemon Banner](./images/daemon.png)

## Overview

Daemon is a lightweight, scalable, standards first framework for building AI agents. It is designed to be easy to understand, easy to use, and easy to extend. While the client is built in Typescript, the modules are designed to operate over JSON RPC and can be written in any language.

## Goals

1. Daemons should have a way to _pool_ resources so you can scale and support swarms of agents.
2. Use [Model Context Protocol](https://modelcontextprotocol.io/) to provide extensibility
3. Memory management and RAG out of the box

## Design

## Quickstart

### Docker

```bash
docker compose up -d
```

### Typescript

```typescript
// Run an Identity MCP Server
const idServer = new IdentityServerPostgres(
  {
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  },
  {
    embedding: {
      provider: "openai",
      endpoint: "https://api.openai.com/v1",
      name: "text-embedding-3-small",
    },
    generation: {
      provider: "openai",
      endpoint: "https://api.openai.com/v1",
      name: "gpt-4o",
    },
  },
  {
    name: "identity-server-daemon",
  }
);
await idServer.init();
idServer.start(3000); // Starts the server on port 3000

// Run a Daemon
let character = await Bun.file("./tests/characters/bob.json").json();
const keypair = Keypair.generate();
character.pubkey = keypair.publicKey.toBase58();
const bob = new Daemon();
await bob.init({
  character,
  contextServerUrl: `http://localhost:3000/sse`,
  privateKey: keypair,
  modelApiKeys: {
    generationKey: process.env.OPENAI_API_KEY!,
    embeddingKey: process.env.OPENAI_API_KEY!,
  },
});

// Send a message to the Daemon
console.log(
  (await bob.message("Hello Bob, built anything cool recently?")).output
);
```

### FAQ

- What is the difference between an AI Agent and an LLM?
  An LLM is a stateless model that can be used to generate text. An AI Agent is a collection of LLMs, tools, and memories that work together to achieve a goal.

- How does this compare with Eliza?
  Eliza's "Runtime" is the Daemon class. "Providers" are context tools. "Actions" are action tools. "Evaluators" are Post Processing tools.

### Roadmap

- Shared Bookkeping Server for API Credits
- Image and Media Support on Lifecycle
- TEE / Private Key support
- Logging System
