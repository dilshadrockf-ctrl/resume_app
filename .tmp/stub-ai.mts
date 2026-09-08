/** Tiny OpenAI-compatible stub for dev testing: returns deterministic
 * "tighten" rewrites. NOT part of the app — sandbox tooling only. */
import * as http from "node:http";

let mode = "rewrite"; // flipped via /mode?m=...

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/mode") {
      mode = url.searchParams.get("m") ?? "rewrite";
      res.end("ok");
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const messages = JSON.parse(body || "{}")?.messages ?? [];
      const user: string = messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
      let content = "";
      if (mode === "nochange") content = "NO_CHANGE";
      else if (mode === "inflate") content = "INVENTED: Won a Nobel prize, ran Mars colony, " + "x".repeat(900);
      else {
        const lines = user
          .split('"""')[1]?.trim()
          .split(/\r?\n/)
          .map((l: string) => l.replace(/^(Led|Worked on|Responsible for|Helped with)\s+/i, "Delivered "))
          .filter(Boolean);
        content = lines.join("\n") || "Delivered platform outcomes.";
        void mode;
      }
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content } }],
          usage: { prompt_tokens: 120, completion_tokens: 40 },
        }),
      );
    });
  })
  .listen(8787, "127.0.0.1", () => console.log("stub-ai on 8787 (openai-compatible)"));
