import "dotenv/config";
import { PermissionRepository } from "../src/modules/permissions/permission.repository";
import { authorizationCache } from "../src/common/helpers/authorization-cache.helper";
import { prisma } from "../src/database/prisma.client";

async function main() {
  console.log("Synchronizing system permissions and roles with PostgreSQL database...");
  const repository = new PermissionRepository();
  await repository.ensureSystemPermissions();
  authorizationCache.invalidateAll();

  const totalPerms = await prisma.permission.count();
  const totalRoles = await prisma.role.count();
  const totalRolePerms = await prisma.rolePermission.count();

  console.log(`\n============================ SUMMARY ============================`);
  console.log(`[✔] Total permissions in DB: ${totalPerms}`);
  console.log(`[✔] Total roles in DB: ${totalRoles}`);
  console.log(`[✔] Total role-permission bindings: ${totalRolePerms}`);
  console.log("System permissions synchronized successfully!");
}

main()
  .catch((err) => {
    console.error("Failed to sync system permissions:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
