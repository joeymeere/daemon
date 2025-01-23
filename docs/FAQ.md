# FAQ 
1. Isn't this just another AI Wrapper? What's the difference between LLMs, web2 frameworks like lang chain, SDKs like Solana Agent Kit, and Agent Frameworks?
	Different people have different definitions for things, but generally I define these things as:
	1. LLM are *stateless* brains that take some input and generate output based on that. 
	2. Agent Frameworks work to add Context (like RAG/Memories/etc) to the input to make the input more "robust" and context relevant
	3. SDKs add tools that that act on what generated output

2. What is AI good for?
	This is a very broad question, but in general, AI is very good at three things.
		1. Ingesting information from various structured or unstructured sources
		2. Processing that information to arrive on some conclusion
		3. Using the conclusion to then take action based on tools provided to it

3. What are the current limitations?
	1. Cannot do anything other than text generation
	2. To make tool processing faster, each step of the message lifecycle is done in parallel, which means lack of ordering on lifecycle execution

## Common Patterns

1. Context + Tool/Action Pattern
	User Challenges:
		I want to have an MCP server that is able to provide the Daemon with a list of tokens to buy then buy them with LLM specified size.
	
	Solution:
		To create this you'd have an MCP server with 2 context tools (can be simplified into one if you wanted) and 1 action tool.
			1. the first context tool (fetchTokensToBuy()) fetches and attaches a list of tokens to the prompt.
			2. the second context tool (addBuyActionTool()) that adds the fact that the LLM can pick "Buy Action" with specific parameters
			3. LLM is fed message + context, and hopefully replies with Buy Action for tokens
			4. Action tool parses LLM output, sees Buy Action output, which it then triggers and registers a hook to sign the buy transaction
			5. Daemon signs and calls the server again (probably a send-transaction-tool) to submit the transaction

2. MCP Router Server
	User Challenges:
		I want to attach multiple tools to my Daemon, but only have them run if the user's message is relevant to that tool. For example, if the user doesn't mention buying tokens, the get getTokenPrice tool should not run.
	
	Solution:
		We can solve this one of two ways.
			1. Each tool can process the incoming message, and see if it should run or not through it's own validate logic. This validate logic might look for certain keywords to running extracting meaning from the message from it's own LLM
			2. Alternatively, if you are the orchestrator of multiple tools, you might have a single Router Server that extracts meaning from the message once, and then it calls the relevant tools in the background, so the Daemon only talks to the router first. 
