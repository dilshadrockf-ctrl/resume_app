import { db } from "../src/db/client.ts";
const r = await db.resume.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
console.log(r?.id, r?.name);
