// Start up Identity Server
// Create a new Daemon from a character file
// Send a message to the daemon and get a response (stateless)
// Send a message to the daemon and get a response that creates a memory
// Send a message to the daemon and get a response that uses the memory to create a response

// TODO: Channel scope

import { Keypair } from "@solana/web3.js";
import { IdentityServerPostgres } from "../packages/daemon/src/IdentityServerPostgres";
import { Daemon } from "../packages/daemon/src/daemon";
import { describe, it } from "bun:test";

// ID Server
const idServer = new IdentityServerPostgres(
  {
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  },
  {
    embedding: {
      provider: "openai",
      endpoint: "https://api.openai.com/v1",
      name: "text-embedding-3-small",
    },
    generation: {
      provider: "openai",
      endpoint: "https://api.openai.com/v1",
      name: "gpt-4o",
    },
  },
  {
    name: "identity-server-daemon",
  }
);

await idServer.init();
idServer.start(3000);

// Daemon from Character File
let character = await Bun.file("./tests/characters/bob.json").json();
const keypair = Keypair.generate();
character.pubkey = keypair.publicKey.toBase58();
const bob = new Daemon();
await bob.init({
  character,
  contextServerUrl: `http://localhost:3000/sse`,
  privateKey: keypair,
  modelApiKeys: {
    generationKey: process.env.OPENAI_API_KEY!,
    embeddingKey: process.env.OPENAI_API_KEY!,
  },
});

// Message Tests
console.log("Bob is initialized and ready to go!");

describe("Bob", () => {
  it("should respond to a stateless message", async () => {
    const msg = "Hello Bob, built anything cool recently?";
    const msgLifecycle = await bob.message(msg, {
      context: false,
      actions: false,
      postProcess: false,
    });
    console.log("USER: ", msg);
    console.log("BOB: ", msgLifecycle.output);
  });

  it("should respond to a message with context", async () => {
    const msg = "Hello Bob, built anything cool recently?";
    const msgLifecycle = await bob.message(msg, {
      context: true,
      actions: false,
      postProcess: false,
    });
    console.log("USER: ", msg);
    console.log("BOB: ", msgLifecycle.output);
    console.log("CONTEXT: ", msgLifecycle.context);
  });

  it("should respond to a message with context and actions", async () => {
    const msg = "Hey Bob, good job on the new horse barn!";
    const msgLifecycle = await bob.message(msg, {
      context: true,
      actions: true,
      postProcess: false,
    });
    console.log("USER: ", msg);
    console.log("BOB: ", msgLifecycle.output);
    console.log("CONTEXT: ", msgLifecycle.context);
  });

  it("should respond to a message with context, actions, and post-processing", async () => {
    const msg = "Hello Bob, built anything cool recently?";
    const msgLifecycle = await bob.message(msg, {
      context: true,
      actions: true,
      postProcess: true,
    });
    console.log("USER: ", msg);
    console.log("BOB: ", msgLifecycle.output);
    console.log("CONTEXT: ", msgLifecycle.context);
    console.log("ACTIONS: ", msgLifecycle.actions);
    console.log("POST-PROCESS: ", msgLifecycle.postProcess);
  });
});
