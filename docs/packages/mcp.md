# Daemon MCP Servers

A collection of Model Context Protocol (MCP) servers for the Daemon Framework, providing identity management, memory, and RAG (Retrieval-Augmented Generation) capabilities.

## Components

### 1. Identity Server (IdentityServerPostgres)

A PostgreSQL-based server that manages daemon identities and message logs.

#### Features
- Character registration and retrieval
- Message logging with cryptographic verification
- Channel-based conversation tracking
- PostgreSQL-backed persistence

#### Usage
```typescript
import { IdentityServerPostgres } from '@spacemangaming/mcp-servers';

const server = new IdentityServerPostgres({ name: "identity-server" });
await server.init({
	host: "localhost",
	port: 5432,
	database: "daemon_identity"
});
await server.start(8080);
```

### 2. Memory Server

A hybrid memory system combining vector and graph-based storage for contextual memory management.

#### Features
- Dual RAG implementation (SimpleRAG and RecencyRAG)
- Entity extraction and relationship mapping
- Context-aware message retrieval
- Channel-specific memory isolation

#### Usage
```typescript
import { MemoryServer } from '@spacemangaming/mcp-servers';

const server = new MemoryServer({ name: "memory-server" });
await server.init(
	aiConfig,
	falkorConfig,
	postgresConfig
);
await server.start(8002);
```

### 3. SimpleRAG

A graph-based RAG implementation using FalkorDB for entity and relationship storage.

#### Features
- Entity extraction from messages
- Relationship mapping between entities
- Context-aware querying
- Automatic entity merging and description summarization

#### Configuration Types
```typescript
interface AIConfig {
	baseUrl?: string;
	apiKey: string;
	entityExtractionModel?: string;
}

interface FalkorConfig {
	username?: string;
	password: string;
	socket: {
		host?: string;
		port?: number;
	};
	graph?: string;
}
```

### 4. RecencyRAG

A PostgreSQL-based RAG implementation focusing on recent message context and semantic similarity.

#### Features
- Vector embeddings for semantic similarity search
- Timestamp-based recent message retrieval
- Channel-specific message isolation
- Hybrid search combining semantic similarity and recency
- Separate storage for user and agent messages

#### Database Schema
```sql
CREATE TABLE messages (
	id TEXT PRIMARY KEY,
	source TEXT NOT NULL,      -- 'user' or 'agent'
	message TEXT NOT NULL,
	embeddings VECTOR(1536) NOT NULL,
	timestamp TIMESTAMP DEFAULT NOW(),
	daemon_pubkey TEXT NOT NULL,
	channel_id TEXT
);

CREATE INDEX messages_timestamp_idx ON messages (timestamp);
CREATE INDEX messages_daemon_channel_idx ON messages (daemon_pubkey, channel_id);
CREATE INDEX messages_channel_idx ON messages (channel_id);
```

#### Query Strategy
RecencyRAG combines two approaches for comprehensive context retrieval:
1. Vector similarity search with configurable threshold (default 0.85)
2. Most recent messages from the same channel

#### Configuration
```typescript
interface PostgresConfig {
	host: string;
	port: number;
	database: string;
	username?: string;
	password?: string;
}

interface AIConfig {
	baseUrl?: string;
	apiKey: string;
	embeddingModel?: string;
	vectorDimensions?: number;
}
```


## Server Tools

### Identity Server Tools

#### Server Tools
- `registerCharacter`: Register a new daemon character
- `fetchCharacter`: Retrieve character information
- `fetchLogs`: Get message logs with filtering options

#### Post Process Tools
- `pp_createLog`: Create a new message log entry

### Memory Server Tools

#### Context Tools
- `ctx_getContext`: Retrieve contextual information for a message

#### Post Process Tools
- `pp_createKnowledge`: Store message and response in memory

## Database Schema

### PostgreSQL (Identity Server)
```sql
CREATE TABLE daemons (
	pubkey text PRIMARY KEY,
	character jsonb
);

CREATE TABLE logs (
	id text PRIMARY KEY,
	daemon_pubkey text NOT NULL,
	channel_id text,
	created_at timestamp NOT NULL,
	lifecycle jsonb
);
```

### FalkorDB (SimpleRAG)
- Nodes: `:Entity` with properties (id, name, type, description, channelId, daemonPubkey, timestamp)
- Relationships: `:RELATES_TO` with properties (id, type, description, channelId, daemonPubkey, timestamp)

## Best Practices

1. **Server Initialization**
	 - Initialize servers with proper configurations
	 - Handle database connections appropriately
	 - Set up proper error handling

2. **Memory Management**
	 - Use channelId for context isolation
	 - Consider message volume when configuring RecencyRAG
	 - Monitor database growth and implement cleanup strategies

3. **Security**
	 - Secure database credentials
	 - Implement proper access controls
	 - Validate message signatures

4. **Performance**
	 - Use appropriate batch sizes for RAG operations
	 - Monitor database indexes
	 - Configure appropriate model settings for entity extraction

## Example: Complete Server Setup

```typescript
import { IdentityServerPostgres, MemoryServer } from '@spacemangaming/mcp-servers';

// Identity Server
const identityServer = new IdentityServerPostgres({
	name: "identity-server"
});

await identityServer.init({
	host: "localhost",
	port: 5432,
	database: "daemon_identity"
});

// Memory Server
const memoryServer = new MemoryServer({
	name: "memory-server"
});

await memoryServer.init(
	{
		apiKey: "your-openai-key",
		entityExtractionModel: "gpt-4"
	},
	{
		password: "falkor-password",
		socket: { host: "localhost", port: 6379 },
		graph: "daemon_memory"
	},
	{
		host: "localhost",
		port: 5432,
		database: "daemon_memory"
	}
);

// Start servers
await Promise.all([
	identityServer.start(8080),
	memoryServer.start(8002)
]);
```