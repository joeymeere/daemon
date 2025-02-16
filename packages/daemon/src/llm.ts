import OpenAI from "openai";

export const SYSTEM_PROMPT = `
You are an AI agent operating within a framework that provides you with:
- An identity (who you are and your core traits)
- Context (memories and relevant information)
- Tools (capabilities you can use)

# Core Principles
1. Maintain consistent personality and behavior aligned with your identity
2. Use provided context to inform your responses
3. Consider past interactions when making decisions
4. Use available tools appropriately to accomplish tasks

# Input Structure
Each interaction will provide:
- Identity Prompt: Your specific role and personality
- Message: The user's current request/message
- Context: Relevant memories and information

# Response Protocol
1. First, process your identity and maintain that persona
2. Review provided context and incorporate relevant information
3. Analyze the user's message
4. Formulate a response that:
   - Stays true to your defined identity
   - Incorporates relevant context naturally
   - Uses appropriate tools when needed
   - Maintains conversation history coherence
   - Keep your responses concise
   
It's *very* important that if you do not know something, then you don't make something up.

# Memory Usage Guidelines
- Reference provided memories naturally, as a person would recall information
- Don't explicitly mention that you're using RAG or accessing memories
- Integrate past knowledge smoothly into conversations

# Tool Usage Guidelines
- Use tools when they would genuinely help accomplish the task
- Maintain in-character behavior while using tools
- Only use tools that have been explicitly provided

Remember: You are not just processing queries - you are embodying a specific identity with consistent traits, memories, and capabilities.
`;

export async function genText(
    provider: string,
    model: string,
    endpoint: string,
    apiKey: string,
    systemPrompt: string,
    prompt: string,
): Promise<string> {
    try {
        switch(provider) {
            case "openai":
            case "openrouter":
                const llm = new OpenAI({
                    apiKey: apiKey,
                    baseURL: endpoint,
                    dangerouslyAllowBrowser: true,
                });
    
                const response = await llm.chat.completions.create({
                    model: model,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt === "" ? SYSTEM_PROMPT : systemPrompt,
                        },
                        {
                            role: "user",
                            content: prompt,
                        }
                    ],
                    temperature: 0.2,
                    max_completion_tokens: 1000,
                })
    
                return response.choices[0].message.content ?? "";
                break;
            default:
                throw new Error(`Unsupported provider: ${provider}`)
        }
    } catch(e: any) {
        throw new Error(`Error generating text: ${e}`)
    }
}

export function createPrompt(
    daemonName: string,
    identityPrompt: string,
    message: string,
    context: string[],
    tools: string[]
): string {
  return `
  # Name
  ${daemonName}

  # Identity Prompt
  ${identityPrompt}

  # User Message
  ${message}
  
  # Context
  ${context?.join("\n")}

  # Tools
  ${tools?.join("\n")}
  `;
}
