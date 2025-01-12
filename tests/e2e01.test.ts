// Start up Identity Server
// Create a new Daemon from a character file
// Send a message to the daemon and get a response (stateless)
// Send a message to the daemon and get a response that creates a memory
// Send a message to the daemon and get a response that uses the memory to create a response

// TODO: Channel scope

import { Keypair } from "@solana/web3.js";
import { IdentityServerPostgres } from "../packages/core/src/IdentityServerPostgres";
import { Daemon } from "../packages/core/src/daemon";

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

console.log(
  "Sending (no context, no actions, no post-processing) message to Bob..."
);
const msg1 = "Hello Bob, built anything cool recently?";
console.log("User: ", msg1);
const msg1Lifecycle = await bob.message(msg1, {
  context: false,
  actions: false,
  postProcess: false,
});
console.log(`Bob: ${msg1Lifecycle.output}`);

// Should mention his house.
console.log("Sending (no post-processing) message to Bob...");
const msg2 = "Hello Bob, built anything cool recently?";
console.log("User: ", msg2);
const msg2Lifecycle = await bob.message(msg2, {
  context: true,
  actions: true,
  postProcess: false,
});
console.log(`Bob: ${msg2Lifecycle.output}`);
console.log(msg2Lifecycle.context);

// Should create a new memory about divorce
console.log("Sending message to Bob...");
const msg3 =
  "Hello Bob, your wife asked me to serve you divorce papers. Looks like you're getting divorced next month.";
console.log("User: ", msg3);
const msg3Lifecycle = await bob.message(msg3, {
  context: true,
  actions: true,
  postProcess: true,
});
console.log(`Bob: ${msg3Lifecycle.output}`);
console.log(msg3Lifecycle.context);
console.log(msg3Lifecycle.postProcess);

// Should mention the divorce maybe?
console.log("Sending message to Bob...");
const msg4 = "Hello Bob, anything interesting happening in your life?";
console.log("User: ", msg4);
const msg4Lifecycle = await bob.message(msg4, {
  context: true,
  actions: true,
  postProcess: true,
});
console.log(`Bob: ${msg4Lifecycle.output}`);
console.log(msg4Lifecycle.context);
console.log(msg4Lifecycle.postProcess);
