# Core Concepts

**Daemons** are broken up into two main components, the core [Daemon Package](https://www.npmjs.com/package/@spacemangaming/daemon?activeTab=readme) and the [MCP Servers Package](https://www.npmjs.com/package/@spacemangaming/mcp-servers). 

## Identity File
A Daemon Identity file is extremely light weight. Most of the "dynamic" nature of a Daemon comes from the servers it connects to and the tools they provide. Each server can track messages/data and provide it's own context and tooling to the daemon. 

```
Name: Daemon Name
Pubkey: A solana public key that the Daemon uses to sign approvals
Model Settings: Generation Model name/api url/api key
Identity Prompt: A small description of who the agent is
Identity Server URL: An Identity MCP server that tracks all logs for the Agent and stores the character file so it can be retrieved.
Bootstrap: A list of servers to connect to on Daemon start and any tools to call during startup
```

## Adding MCP Servers
Beyond bootstrapping during initialization, servers can be registered and deregistered with the Daemon at any time through addMCPServer() and removeMCPServer() methods. These methods dynamically get tools manifest from the server and add it to the Daemon's tool map.

## Daemon MCP Servers

Many Daemons can connect to the same Daemon Tool Server, allowing scalable architecture where thousands of agents could run and be using the same tools . 

![modular](./img/modular.png)

Servers can provide four different types of tools:

1. Server Tools
    Server tools are *not* called during the message lifecycle, and instead are called on-demand. Examples of these types of tools are registration tools (such as those called on the Identity Server during instancing) or a transaction submission tool that has the Daemon submit a signed payload to a server to have it processed.

2. Context Tools
    Context tools are the first set of tools to be called during the message lifecycle. They are used to add additional context (like memories or price data for token, or whatever else)

3. Action Tools
    Actions tools are called to take the generated text and then take actions on it (like creating a transaction for buying a token).

4. Post Process Tools
    Post Process Tools are the last set of tools to be called and they do things like create new memories based on generated text + actions taken.

<span style="bg-color: gray">
One thing to note about tools is that each steps calls *all* the tools the servers connected to the Daemon provide for that step. If for some reason a tool should *not* operate on a given message, it's up to that tool to determine if it's relevant or not. For example, if the user did not ask for token prices, it's likely the Token Price Context Tool should not run. 

</span>

- Server, Context, Actions, Post Process

### Message Lifecycle
Currently, Daemon only supports text input and output through the message() function right now, but it's on the roadmap to add multimodal capabilities in the future. 
A message can be sent with the following arguments:

```
message: The User's message
opts (optional) 
    channelId (optional) A unique ID for the "room" the agent is talking in. Useful for knowledge/memory systems to retreive memory only for that room
    context (optional) True/False (defaults true) Do you want to fetch additional context (like memory) from any context tools of the server(s) connected
    actions (optional) True/False (deafults true) Do you want to fetch any actions from contected server(s) (like being able to post on Twitter)
    postProcess (optional) True/False (defaults true) Do you want to post process the message with all connected servers (like being able to create new memories from the input message)
    toolArgs (optional) `serverUrl-toolName` -> any{} when calling any of the tools, do you want to pass in any special arguments
```
Let's break this down into how Daemon 










- Approvals
- Message Lifecycle (optionals)
- Hooks
- Signing
- Bootstrap
