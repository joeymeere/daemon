# Daemon vs Eliza

- When should I use Daemon over Eliza?
	- Eliza is probably better for you if you're only looking to run a few agents, as the agents come packaged with all their tools. Eliza is also has more support for media generation, and non text input/output (for now!). Eliza is also the better bet if you're looking for support for things like TEE or other specific features which aren't supported in Daemon just yet. However, if you're looking to launch scalable agents or do agent coordination, or have your agents share tools, or do advanced customization beyond just a personality chatbot, Daemon might be worth the try.

- Eliza vs Daemon terminology
	- "Plugins" - Instead of having custom plugins built for the AI agent, Daemon uses the MCP standard to be able to connect to a massive ecosystem of tools and resources available on the internet. This also means the agent itself can be more lightweight and since the communication between the Agent <> Server is done via JSON RPC, the servers can be written in any language and hosted anywhere (no need to create typescript SDKs for everything!)
	- "Adapters" - No need for adapters as each server handles it's own database/etc and and serves info through tools
	- "Client" - Eliza Clients (like Discord) become Action tools provided by MCP servers in Daemon
	- "Characters" - Characters in Daemon are incredibly slim and most of the additional context is handled through "bootstrap" object which is an array of servers to connect to and args to feed in for any bootstrap tools to call

- Eliza vs Daemon Message Lifecycle
	- "Providers" - Eliza providers are "Context Tools" in Daemon served by various servers
	- "Actions" - Eliza "Actions" are "Action Tools" in Daemon served by various servers
	- "Evaluators" - Eliza "Evaluators" are "Post Processing Tools" in Daemon served by various servers