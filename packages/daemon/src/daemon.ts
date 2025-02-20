import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "./SSEClientTransport";
import type { TextContent } from "@modelcontextprotocol/sdk/types";
import type { Keypair } from "@solana/web3.js";
import { createPrompt, genText } from "./llm";
import nacl from "tweetnacl";
import { nanoid } from "nanoid";
import { Buffer } from "buffer";
import type {
  Character,
  IHook,
  IHookLog,
  IMessageLifecycle,
  ModelProvider,
  ToolProvider,
  IDaemon,
} from "./types";
import { BehaviorSubject } from "rxjs";
import { ToolCaller } from "./utils/tool-caller";

const DEFAULT_IDENTITY_PROMPT = (name: string) => {
  return `
You are ${name}. Keep your responses concise and to the point.
  `;
};

export class Daemon implements IDaemon {
  character: Character;
  keypair: Keypair;
  models: ModelProvider = {};
  tools: ToolProvider[] = [];

  constructor(character: Character, keypair: Keypair) {
    this.character = character;
    this.keypair = keypair;
  }

  async addModelProvider(provider: ModelProvider): Promise<void> {
    this.models = {
      ...this.models,
      ...provider,
    };
  }

  async addSingleToolFromProvider(provider: ToolProvider): Promise<void> {
    this.tools.push(provider);
  }

  async addAllToolsByProvider(url: string): Promise<void> {
    const client = new Client(
      {
        name: url,
        version: "1.0.0",
      },
      { capabilities: {} }
    );

    const serverInfo = (
      await client.callTool({
        name: "getDaemonServerInfo",
        arguments: {},
      })
    ).content as TextContent[];

    if (serverInfo[0].text.includes("Error")) {
      throw new Error(serverInfo[0].text);
    }

    const toolsList = JSON.parse(serverInfo[0].text) as ToolProvider[];

    await Promise.all(
      toolsList.map(async (tool) => {
        await this.addSingleToolFromProvider(tool);
      })
    );
  }

  async callTool(tool: ToolProvider, args: any): Promise<any> {
    return ToolCaller.callWithRetries(tool, args);
  }

  sign(args: { payload: string }): string {
    if (!this.keypair) {
      throw new Error("Keypair not found");
    }

    const messageBytes = Uint8Array.from(Buffer.from(args.payload, "base64"));
    const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    return Buffer.from(signature).toString("base64");
  }

  async hook(hook: IHook): Promise<IHookLog> {
    try {
      switch (hook.daemonTool) {
        case "sign":
          hook.hookOutput = this.sign(hook.daemonArgs);
          break;
      }
      const client = new Client(
        {
          name: hook.hookTool.hookServerUrl,
          version: "1.0.0",
        },
        { capabilities: {} }
      );
      const result = await client.callTool({
        name: hook.hookTool.toolName,
        arguments: {
          ...hook.hookTool.toolArgs,
          daemonOutput: hook.hookOutput,
        },
      });
      return result;
    } catch (e) {
      throw e;
    }
  }

  private generateApproval(
    message: string,
    createdAt: string,
    messageId: string,
    channelId?: string
  ): string {
    if (!this.keypair) {
      throw new Error("Keypair not found");
    }

    const messageBytes = Buffer.from(
      JSON.stringify(
        {
          message: message,
          createdAt: createdAt,
          messageId: messageId,
          channelId: channelId ?? "",
        },
        null,
        0
      ),
      "utf-8"
    );

    const approval = this.sign({
      payload: messageBytes.toString("base64"),
    });

    return approval;
  }

  async messageStream(
    messages: string[],
    opts?: {
      channelId?: string;
      stages?: {
        context?: boolean;
        actions?: boolean;
        postProcess?: boolean;
      };
      toolArgs?: {
        [key: string]: any;
      };
      llm?: {
        provider: string;
        model: string;
        endpoint?: string;
        apiKey?: string;
        systemPrompt?: string;
      };
    }
  ): Promise<BehaviorSubject<Partial<IMessageLifecycle>>[]> {
    return Promise.all(messages.map((msg) => this.message(msg, opts)));
  }

  async message(
    message: string,
    opts?: {
      channelId?: string;
      stages?: {
        context?: boolean;
        actions?: boolean;
        postProcess?: boolean;
      };
      toolArgs?: {
        [key: string]: any;
      };
      llm?: {
        provider: string;
        model: string;
        endpoint?: string;
        apiKey?: string;
        systemPrompt?: string;
      };
    }
  ) {
    try {
      if (Object.keys(this.models).length === 0 && !opts?.llm) {
        throw new Error("No model provider added");
      }

      let llm = {};
      const provider: string =
        opts?.llm?.provider ?? Object.keys(this.models)[0];
      if (!provider) {
        throw new Error("No LLM provider chosen");
      }

      const model: string =
        opts?.llm?.model ?? Object.keys(this.models[provider])[0];
      if (!model) {
        throw new Error("No LLM model chosen");
      }

      const apiKey = opts?.llm?.apiKey ?? this.models[provider].apiKey;
      if (!apiKey) {
        throw new Error("No LLM API key chosen");
      }

      const endpoint = opts?.llm?.endpoint ?? this.models[provider].endpoint;
      if (!endpoint) {
        throw new Error("No LLM endpoint chosen");
      }

      const context = opts?.stages?.context ?? true;
      const actions = opts?.stages?.actions ?? true;
      const postProcess = opts?.stages?.postProcess ?? true;

      const lifecycle = new BehaviorSubject<Partial<IMessageLifecycle>>({
        daemonPubkey: this.keypair.publicKey.toBase58(),
        daemonName: this.character.name,
        messageId: nanoid(),
        message: message,
        createdAt: new Date().toISOString(),
        approval: this.generateApproval(
          message,
          new Date().toISOString(),
          nanoid(),
          opts?.channelId ?? undefined
        ),
        channelId: opts?.channelId ?? undefined,
        identityPrompt:
          this.character.identityPrompt ??
          DEFAULT_IDENTITY_PROMPT(this.character.name),
        context: [],
        tools: [],
        generatedPrompt: "",
        output: "",
        hooks: [],
        hooksLog: [],
        actionsLog: [],
        postProcessLog: [],
      });

      if (context) {
        const contextTools = this.tools.filter(
          (tool) => tool.type === "context"
        );
        const contextResults = await Promise.allSettled(
          contextTools.map((tool) =>
            this.callTool(tool, {
              lifecycle: lifecycle.value,
              args: opts?.toolArgs?.[`${tool.serverUrl}-${tool.tool}`] ?? {},
            })
          )
        );

        lifecycle.next({
          ...lifecycle.value,
          context: contextResults
            .filter(
              (result): result is PromiseFulfilledResult<any> =>
                result.status === "fulfilled"
            )
            .map((result) => result.value),
        });
      }

      lifecycle.next({
        ...lifecycle.value,
        generatedPrompt: createPrompt(
          lifecycle.value.daemonName ?? "",
          lifecycle.value.identityPrompt ?? "",
          lifecycle.value.message ?? "",
          lifecycle.value.context ?? [],
          lifecycle.value.tools ?? []
        ),
      });

      lifecycle.next({
        ...lifecycle.value,
        output: await genText(
          provider,
          model,
          endpoint,
          apiKey,
          opts?.llm?.systemPrompt ?? "",
          lifecycle.value.generatedPrompt!
        ),
      });

      if (actions) {
        const actionTools = this.tools.filter((tool) => tool.type === "action");
        const actionResults = await Promise.allSettled(
          actionTools.map((tool) =>
            this.callTool(tool, {
              lifecycle: lifecycle.value,
              args: opts?.toolArgs?.[`${tool.serverUrl}-${tool.tool}`] ?? {},
            })
          )
        );

        lifecycle.next({
          ...lifecycle.value,
          actionsLog: actionResults
            .filter(
              (result): result is PromiseFulfilledResult<any> =>
                result.status === "fulfilled"
            )
            .map((result) => result.value),
        });

        if (lifecycle.value.hooks?.length) {
          const hookResults = await Promise.allSettled(
            lifecycle.value.hooks.map((hook) => this.hook(hook))
          );

          lifecycle.next({
            ...lifecycle.value,
            hooksLog: hookResults
              .filter(
                (result): result is PromiseFulfilledResult<any> =>
                  result.status === "fulfilled"
              )
              .map((result) => result.value),
          });
        }
      }

      if (postProcess) {
        const postProcessTools = this.tools.filter(
          (tool) => tool.type === "postProcess"
        );
        const postProcessResults = await Promise.allSettled(
          postProcessTools.map((tool) =>
            this.callTool(tool, {
              lifecycle: lifecycle.value,
              args: opts?.toolArgs?.[`${tool.serverUrl}-${tool.tool}`] ?? {},
            })
          )
        );

        lifecycle.next({
          ...lifecycle.value,
          postProcessLog: postProcessResults
            .filter(
              (result): result is PromiseFulfilledResult<any> =>
                result.status === "fulfilled"
            )
            .map((result) => result.value),
        });
      }

      return lifecycle;
    } catch (e: any) {
      throw new Error(`Message processing failed: ${e.message}`);
    }
  }
}
