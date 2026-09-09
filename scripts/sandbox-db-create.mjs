import { Client } from "pg";

const { host, port, user, dbName } = JSON.parse(process.argv[2]);
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

async function main() {
  const c = new Client({ host, port, user, database: "postgres" });
  await c.connect();
  const exists = await c.query("SELECT 1 FROM pg_database WHERE datname=$1", [dbName]);
  if (exists.rowCount === 0) {
    await c.query(`CREATE DATABASE ${ident(dbName)} TEMPLATE template1`);
    console.log(`created database ${dbName}`);
  } else {
    console.log(`database ${dbName} exists`);
  }
  await c.end();
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e).slice(0, 300));
  process.exit(1);
});
