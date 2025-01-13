import { IdentityServerPostgres } from "@spacemangaming/mcp-servers";
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
