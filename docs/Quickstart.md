# Quickstart Guide

## Running Local Chat

Start with git clong the repo which has everything you need to start up a local LLM chat and see how everything connects

```
git clone git@github.com:Spaceman-Gaming/daemon.git
```

### Docker Setup

0. Fill out your OPENAI API key in .env file
You can configure with other API services but if you're just trying the default setup out, it's meant to use Open AI.

1. Use the compose file in this project root:

```yaml
name: daemon

services:
	chat:
		build:
			context: .
			dockerfile: Chat.Dockerfile
		restart: on-failure
		ports:
			- "3001:3001" # id server proxy
			- "3002:3002" # mem server proxy
			- "6001:6001" # id server
			- "6002:6002" # mem server
			- "5173:5173" # sveltekit dev server
		environment:
			- OPENAI_API_KEY=${OPENAI_API_KEY}
		networks:
			- daemon-network
		depends_on:
			postgres:
				condition: service_healthy
			falkordb:
				condition: service_healthy

	postgres: # Used for ID Server and Recency and Semantic RAG (vector)
		image: pgvector/pgvector:0.8.0-pg17
		environment:
			POSTGRES_USER: ${POSTGRES_USER:-postgres}
			POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
			POSTGRES_DB: ${POSTGRES_DB:-app}
		ports:
			- "5432:5432"
		volumes:
			- postgres-data:/var/lib/postgresql/data
		networks:
			- daemon-network
		healthcheck:
			test: ["CMD-SHELL", "pg_isready -U postgres"]
			interval: 5s
			timeout: 5s
			retries: 5

	falkordb: # used for Knowledge Graph RAG
		image: falkordb/falkordb:latest
		ports:
			- "6379:6379"
			- "3000:3000"
		volumes:
			- falkordb_data:/data
		networks:
			- daemon-network
		healthcheck:
			test: ["CMD-SHELL", "redis-cli ping"]
			interval: 10s
			timeout: 5s
			retries: 5

networks:
	daemon-network:
		driver: bridge

volumes:
	postgres-data:
	falkordb_data:
```

2. Start the services:
```bash
docker compose up -d
```

This will start:
- Chat interface at http://localhost:5173
- Identity server at http://localhost:3001
- Memory server at http://localhost:3002
- Postgres database at localhost:5432
- FalkorDB at localhost:6379

## Using Daemon in Your Code

### Installation

```bash
npm install @spacemangaming/daemon @solana/web3.js bs58
```

### Basic Usage

Here's how to create and initialize a Daemon instance:

```typescript
import { Daemon } from '@spacemangaming/daemon';
import { type Character } from '@spacemangaming/daemon';
import { Keypair } from '@solana/web3.js';

// Create a character configuration
const newCharacter = (name: string, identityPrompt: string, pubkey: string) => {
	return {
		name,
		pubkey,
		identityPrompt,
		identityServerUrl: 'http://localhost:3001/sse',
		modelSettings: {
			generation: {
				provider: 'openai',
				endpoint: 'https://api.openai.com/v1',
				name: 'gpt-4',
				apiKey: 'your-openai-key',
			},
			embedding: {
				provider: 'openai',
				endpoint: 'https://api.openai.com/v1',
				name: 'text-embedding-3-small',
				apiKey: 'your-openai-key',
			},
		},
		bootstrap: [{
			serverUrl: 'http://localhost:3002/sse', // memoryServer
			tools: [] 
		}]
	}
}

// Generate a keypair for the agent
const keypair = Keypair.generate();

// Create character config
const character = newCharacter(
	"Bob the Builder",
	"You are Bob the builder",
	keypair.publicKey.toBase58()
);

// Initialize the daemon
const daemon = new Daemon();
await daemon.init(character.identityServerUrl, {
	character: character,
	privateKey: keypair,
	modelApiKeys: {
		generationKey: 'your-openai-key',
		embeddingKey: 'your-openai-key',
	},
});

// Send a message
const response = await daemon.message('Hello!', {
	channelId: 'your-channel-id',
});
console.log(response.output);
```

## Important Notes

1. Always keep your OpenAI API key secure and never commit it to version control
2. The identity and memory servers are required for full functionality
3. Make sure all services are running before initializing the Daemon
4. Each agent requires a unique keypair and channel ID for proper message routing
5. The docker compose setup includes Postgres with pgvector for embeddings storage and FalkorDB for memory management

## Error Handling

Always wrap daemon initialization and message sending in try-catch blocks:

```typescript
try {
	await daemon.init(character.identityServerUrl, {
		character,
		privateKey: keypair,
		modelApiKeys: {
			generationKey: 'your-openai-key',
			embeddingKey: 'your-openai-key',
		},
	});
} catch (error) {
	console.error('Error initializing daemon:', error);
}

try {
	const response = await daemon.message('Hello!', {
		channelId: 'your-channel-id',
	});
} catch (error) {
	console.error('Error sending message:', error);
}
```