# FAQ 


1. Isn't this just another AI Wrapper? What's the difference between LLMs, web2 frameworks like lang chain, SDKs like Solana Agent Kit, and Agent Frameworks?

2. What are the current limitations?
	- Cannot do anything other than text generation
	- To make tool processing faster, each step of the message lifecycle is done in parallel, which means lack of ordering on lifecycle execution

## Common Patterns

1. I want to have an MCP server that is able to provide the Daemon with a list of tokens to buy then buy them with LLM specified size.
	1. To create this you'd have an MCP server with 2 context tools (can be simplified into one if you wanted) and 1 action tool.
		1. the first context tool (fetchTokensToBuy()) fetches and attaches a list of tokens to the prompt.
		2. the second context tool (addBuyActionTool()) that adds the fact that the LLM can pick "Buy Action" with specific parameters
		3. LLM is fed message + context, and hopefully replies with Buy Action for tokens
		4. Action tool parses LLM output, sees Buy Action output, which it then triggers.

2. I only want a tool to run if the incoming message is relevant for it. For example, only running fetch tokens if the message asks which tokens to buy.
	1. In the tool, process the incoming message with your own call to an LLM (usually a small model) that will tell you if the incoming message is relevant to the tool or not.
		1. If you're making sub LLM calls, you might also want to run a "router" server such that incoming messages get processed by your LLM *once* and it tells you what context to attach to the message for the Daemon based on what context tools you can use.
	2. Alternatively use things like common word regex to see if incoming message contains keywords 

3. Running in a TEE for safer transactions. 

4. MCP Router Pattern