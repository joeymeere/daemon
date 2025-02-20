import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "../SSEClientTransport";
import type { ToolProvider } from "../types";

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  timeout: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  timeout: 10000,
};

export class ToolCaller {
  private static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMsg: string
  ): Promise<T> {
    let timeoutHandle: Timer;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Timeout: ${errorMsg}`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutHandle!);
      return result as T;
    } catch (error) {
      clearTimeout(timeoutHandle!);
      throw error;
    }
  }

  static async callWithRetries(
    tool: ToolProvider,
    args: any,
    config: Partial<RetryConfig> = {}
  ): Promise<any> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < finalConfig.maxRetries; attempt++) {
      try {
        const client = new Client(
          {
            name: tool.serverUrl,
            version: "1.0.0",
          },
          { capabilities: {} }
        );

        await client.connect(new SSEClientTransport(new URL(tool.serverUrl)));

        return await this.withTimeout(
          client.callTool({
            name: tool.tool,
            arguments: args,
          }),
          finalConfig.timeout,
          `Tool call to ${tool.tool} timed out`
        );
      } catch (error) {
        lastError = error as Error;
        if (attempt < finalConfig.maxRetries - 1) {
          const delay = finalConfig.baseDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    throw new Error(
      `Failed to call tool ${tool.tool} after ${finalConfig.maxRetries} attempts. Last error: ${lastError?.message}`
    );
  }
}
