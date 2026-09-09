import { Client } from "pg";

const { socketDir, port, user, password, dbName } = JSON.parse(process.argv[2]);
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

async function connect() {
  // Prefer the trust-auth unix socket on unix; fall back to TCP + password
  // (Windows: node-pg cannot reach postgres over a unix-socket path).
  const attempts =
    process.platform === "win32"
      ? [{ host: "127.0.0.1", port, user, password, database: "postgres" }]
      : [
          { host: socketDir, port, user, database: "postgres" },
          { host: "127.0.0.1", port, user, password, database: "postgres" },
        ];
  let lastErr;
  for (const cfg of attempts) {
    const c = new Client(cfg);
    try {
      await c.connect();
      return c;
    } catch (e) {
      lastErr = e;
      try {
        await c.end();
      } catch {
        /* ignore */
      }
    }
  }
  throw lastErr;
}

async function main() {
  const c = await connect();
  try {
    const exists = await c.query("SELECT 1 FROM pg_database WHERE datname=$1", [dbName]);
    if (exists.rowCount === 0) {
      await c.query(`CREATE DATABASE ${ident(dbName)} TEMPLATE template1`);
      console.log(`created database ${dbName}`);
    } else {
      console.log(`database ${dbName} exists`);
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e).slice(0, 300));
  process.exit(1);
});
