import { ContextServerPostgres } from "./contextServerPostgres";

const db = new ContextServerPostgres({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "postgres",
});

console.log(await db.init());
