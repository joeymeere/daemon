# MCP Servers

A set of common MCP servers for the Daemon Framework.

## Getting Started

To get started, you can install the MCP Servers package and start building your own agents.

```bash
bun add @spacemangaming/daemon @spacemangaming/mcp-servers
```

## MCP Servers

### Identity Server

Tracks logs of all incoming and outgoing messages and stores the Daemon's character file.

### Knowledge Server
For any given daemon's pubkey, it will store all of the messages (tagged with optional channelId), and provide any matching context strings when a new message comes in.