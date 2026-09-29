/** يزرع المؤسسات والمستخدمين التجريبيين (عبر دور التطبيق وتحت RLS). */
import { withOrg, withUser, closeDb } from "../src/server/db/client";
import { closeKeystore } from "../src/server/crypto/keystore";
import { memberships, organizations, users } from "../src/server/db/schema";
import { DEV_ORGS, DEV_USERS } from "../src/server/dev-users";

export async function seed() {
  for (const u of DEV_USERS) {
    await withUser(u.id, (tx) =>
      tx.insert(users).values({ id: u.id, email: u.email, name: u.name }).onConflictDoNothing(),
    );
  }
  for (const o of DEV_ORGS) {
    await withOrg({ orgId: o.id }, async (tx) => {
      await tx.insert(organizations).values({ id: o.id, name: o.name }).onConflictDoNothing();
      for (const u of DEV_USERS.filter((x) => x.orgId === o.id)) {
        await tx.insert(memberships).values({ orgId: o.id, userId: u.id, role: u.role }).onConflictDoNothing();
      }
    });
  }
}

const isMain = process.argv[1]?.endsWith("seed.ts");
if (isMain) {
  seed()
    .then(() => console.info(`seeded ${DEV_ORGS.length} organizations, ${DEV_USERS.length} users`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeDb();
      await closeKeystore();
    });
}
