/**
 * عملية العامل: npm run worker
 * تتصل بقاعدة البيانات بنفس دور التطبيق (wathiq_app) وتخضع لـ RLS.
 */
import os from "node:os";
import { env } from "@/server/env";
import { closeDb } from "@/server/db/client";
import { closeKeystore } from "@/server/crypto/keystore";
import { processOne } from "./run";

const workerId = `${os.hostname()}:${process.pid}`;
let stopping = false;

async function main() {
  const { WORKER_POLL_MS } = env();
  console.info(`[worker] ${workerId} started`);
  while (!stopping) {
    let result;
    try {
      result = await processOne(workerId);
    } catch (e) {
      console.error("[worker] loop error", e);
      result = "idle";
    }
    if (result === "idle") await new Promise((r) => setTimeout(r, WORKER_POLL_MS));
  }
  await closeDb();
  await closeKeystore();
  console.info("[worker] stopped");
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.info(`[worker] ${sig} received, finishing current job…`);
    stopping = true;
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
