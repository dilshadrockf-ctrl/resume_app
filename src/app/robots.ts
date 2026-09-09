import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  // Landing pages may be indexed on the operator's deployment; app data never is
  // (all app pages set robots: noindex individually).
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: undefined,
    host: env.NEXT_PUBLIC_APP_URL,
  };
}
