import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { Readable } from "node:stream";
import { stat, writeFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * StorageProvider abstraction (§8/§62). Two implementations:
 *  - MinIOStorage — S3-compatible (MinIO locally, any S3 in production)
 *  - FilesystemStorage — plain local disk fallback for dev/test
 * Selected by STORAGE_DRIVER + availability probe; never crashes the app.
 */

export interface StoredFile {
  key: string;
  bytes: number;
  contentType: string;
  sha256: string;
}

export interface StorageProvider {
  readonly name: "minio" | "filesystem";
  put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<StoredFile>;
  get(key: string): Promise<{ stream: Buffer; contentType: string; bytes: number } | null>;
  /** Stream to an HTTP response body without buffering whole file when possible. */
  open(
    key: string,
  ): Promise<{ body: ReadableStream<Uint8Array>; contentType: string; bytes: number } | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  presignDownload(key: string, filename: string, ttlSeconds: number): Promise<string | null>;
}

export function makeKey(prefix: string, userId: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-]+/g, "_").slice(-80);
  return `${prefix}/${userId}/${Date.now().toString(36)}-${randomUUID().slice(0, 8)}-${safe}`;
}

class FilesystemStorage implements StorageProvider {
  readonly name = "filesystem" as const;
  private root: string;

  constructor(root: string) {
    this.root = resolve(root);
    if (!existsSync(this.root)) mkdirSync(this.root, { recursive: true });
  }

  private pathFor(key: string): string {
    const p = normalize(join(this.root, key));
    if (!p.startsWith(this.root)) throw new Error("Invalid storage key");
    return p;
  }

  async put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<StoredFile> {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const p = this.pathFor(key);
    await mkdirSyncP(p.slice(0, p.lastIndexOf("/")));
    await writeFile(p, buf);
    void contentType;
    return { key, bytes: buf.length, contentType, sha256: sha256(buf) };
  }

  async get(key: string): Promise<{ stream: Buffer; contentType: string; bytes: number } | null> {
    try {
      const p = this.pathFor(key);
      const buf = await import("node:fs/promises").then((fs) => fs.readFile(p));
      return { stream: buf, contentType: guessType(key), bytes: buf.length };
    } catch {
      return null;
    }
  }

  async open(key: string) {
    const p = this.pathFor(key);
    if (!existsSync(p)) return null;
    const st = await stat(p);
    const nodeStream = createReadStream(p);
    const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return { body: stream, contentType: guessType(key), bytes: st.size };
  }

  async delete(key: string): Promise<void> {
    const { unlink } = await import("node:fs/promises");
    await unlink(this.pathFor(key)).catch(() => undefined);
  }

  async exists(key: string) {
    return existsSync(this.pathFor(key));
  }

  async presignDownload(): Promise<string | null> {
    return null; // not supported — app uses authenticated streaming endpoint
  }
}

class MinIOStorage implements StorageProvider {
  readonly name = "minio" as const;
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials:
        env.S3_ACCESS_KEY && env.S3_SECRET_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
          : undefined,
    });
  }

  async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        log.info("storage bucket created", { bucket: this.bucket });
      } catch (e) {
        throw new Error(`Bucket unavailable: ${String((e as Error).message).slice(0, 120)}`);
      }
    }
  }

  async put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<StoredFile> {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buf, ContentType: contentType }),
    );
    return { key, bytes: buf.length, contentType, sha256: sha256(buf) };
  }

  async get(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) return null;
      const buf = Buffer.from(bytes);
      return { stream: buf, contentType: res.ContentType ?? guessType(key), bytes: buf.length };
    } catch {
      return null;
    }
  }

  async open(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      const web = res.Body.transformToWebStream();
      return {
        body: web as ReadableStream<Uint8Array>,
        contentType: res.ContentType ?? guessType(key),
        bytes: res.ContentLength ?? 0,
      };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await this.client
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
      .catch(() => undefined);
  }

  async exists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async presignDownload(key: string, filename: string, ttlSeconds: number): Promise<string | null> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
        }),
        { expiresIn: ttlSeconds },
      );
    } catch {
      return null;
    }
  }
}

function mkdirSyncP(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function guessType(key: string): string {
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (key.endsWith(".txt")) return "text/plain";
  if (key.endsWith(".json")) return "application/json";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

let provider: StorageProvider | null = null;
let probing = false;
let probePromise: Promise<StorageProvider> | null = null;

async function probe(): Promise<StorageProvider> {
  const wantMinio =
    env.STORAGE_DRIVER === "minio" || (env.STORAGE_DRIVER === "auto" && Boolean(env.S3_ENDPOINT));
  if (wantMinio) {
    try {
      const s = new MinIOStorage();
      await s.ensureBucket();
      log.info("storage: minio connected", { endpoint: env.S3_ENDPOINT, bucket: env.S3_BUCKET });
      return s;
    } catch (e) {
      if (env.STORAGE_DRIVER === "minio") throw e; // explicit request → fail loudly
      log.warn("storage: minio unreachable, falling back to filesystem", {
        err: String((e as Error).message).slice(0, 140),
      });
    }
  }
  return new FilesystemStorage(env.FILESYSTEM_STORAGE_DIR);
}

export async function storage(): Promise<StorageProvider> {
  if (provider) return provider;
  if (!probePromise) {
    probing = true;
    probePromise = probe()
      .then((p) => {
        provider = p;
        return p;
      })
      .finally(() => {
        probing = false;
      });
  }
  return probePromise;
}

export function storageStatus(): { ok: boolean; driver: string; detail: string } {
  if (provider)
    return {
      ok: true,
      driver: provider.name,
      detail:
        provider.name === "minio"
          ? `S3 endpoint ${env.S3_ENDPOINT} bucket ${env.S3_BUCKET}`
          : env.FILESYSTEM_STORAGE_DIR,
    };
  void probing;
  return {
    ok: false,
    driver: env.STORAGE_DRIVER,
    detail: "not yet initialized (initializes on first use)",
  };
}

export function resetStorageCacheForTests() {
  provider = null;
  probePromise = null;
}
