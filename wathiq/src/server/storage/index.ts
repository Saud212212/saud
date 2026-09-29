import { mkdir, readFile, rm, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { env } from "../env";

/**
 * تخزين كائنات. كل ما يُكتب هنا مشفّر مسبقاً بمفتاح المنافسة (لا يعتمد على تشفير المزود).
 * برنامجان: local (تطوير/اختبار) و s3 (MinIO أو أي مزود متوافق — بما فيها مزودون داخل السعودية).
 */
export interface ObjectStorage {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** يحذف كل الكائنات تحت البادئة ويُرجع عددها. */
  deletePrefix(prefix: string): Promise<number>;
  list(prefix: string): Promise<string[]>;
}

class LocalStorage implements ObjectStorage {
  constructor(private root: string) {}
  private resolve(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root) + path.sep)) throw new Error("invalid storage key");
    return p;
  }
  async put(key: string, body: Buffer) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body, { mode: 0o600 });
  }
  async get(key: string) {
    return readFile(this.resolve(key));
  }
  async list(prefix: string) {
    const dir = this.resolve(prefix);
    const out: string[] = [];
    const walk = async (d: string) => {
      let entries: string[];
      try {
        entries = await readdir(d);
      } catch {
        return;
      }
      for (const e of entries) {
        const full = path.join(d, e);
        if ((await stat(full)).isDirectory()) await walk(full);
        else out.push(path.relative(path.resolve(this.root), full).split(path.sep).join("/"));
      }
    };
    await walk(dir);
    return out;
  }
  async deletePrefix(prefix: string) {
    const keys = await this.list(prefix);
    const dir = this.resolve(prefix);
    await rm(dir, { recursive: true, force: true });
    return keys.length;
  }
}

class S3Storage implements ObjectStorage {
  private client: S3Client;
  constructor(private bucket: string) {
    const e = env();
    this.client = new S3Client({
      endpoint: e.S3_ENDPOINT,
      region: e.S3_REGION,
      forcePathStyle: e.S3_FORCE_PATH_STYLE === "true",
      credentials:
        e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }
  private bucketReady?: Promise<void>;
  /** ينشئ الحاوية إن لم توجد (مفيد للتطوير المحلي؛ في الإنتاج تُنشأ مسبقاً بلا versioning). */
  private ensureBucket() {
    this.bucketReady ??= this.client
      .send(new HeadBucketCommand({ Bucket: this.bucket }))
      .then(() => undefined)
      .catch(async () => {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      });
    return this.bucketReady;
  }
  async put(key: string, body: Buffer) {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: "application/octet-stream" }),
    );
  }
  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async list(prefix: string) {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const o of res.Contents ?? []) if (o.Key) keys.push(o.Key);
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }
  async deletePrefix(prefix: string) {
    const keys = await this.list(prefix);
    for (let i = 0; i < keys.length; i += 1000) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
        }),
      );
    }
    return keys.length;
  }
}

const g = globalThis as unknown as { __wathiqStorage?: ObjectStorage };

export function storage(): ObjectStorage {
  if (!g.__wathiqStorage) {
    const e = env();
    g.__wathiqStorage = e.STORAGE_DRIVER === "s3" ? new S3Storage(e.S3_BUCKET) : new LocalStorage(e.STORAGE_LOCAL_DIR);
  }
  return g.__wathiqStorage;
}

export const tenderPrefix = (orgId: string, tenderId: string) => `org/${orgId}/tenders/${tenderId}/`;
export const tenderFileKey = (orgId: string, tenderId: string, fileId: string) =>
  `${tenderPrefix(orgId, tenderId)}${fileId}.bin`;
