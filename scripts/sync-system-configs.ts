import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SYSTEM_CONFIGS } from "../src/common/constants/system-config.constant";

const prisma = new PrismaClient();

async function main() {
  console.log(`Synchronizing ${DEFAULT_SYSTEM_CONFIGS.length} system configs to database...`);
  let upserted = 0;

  for (const item of DEFAULT_SYSTEM_CONFIGS) {
    await prisma.systemConfig.upsert({
      where: { key: item.key },
      update: {
        value: item.value as any,
        description: item.description ?? null,
        category: item.category,
        isPublic: item.isPublic,
      },
      create: {
        key: item.key,
        value: item.value as any,
        description: item.description ?? null,
        category: item.category,
        isPublic: item.isPublic,
      },
    });
    upserted++;
    console.log(`[✔] Upserted: ${item.key} (${item.category}, public: ${item.isPublic})`);
  }

  const allowedKeys = new Set(DEFAULT_SYSTEM_CONFIGS.map((c) => c.key));
  const deleteResult = await prisma.systemConfig.deleteMany({
    where: {
      key: {
        notIn: Array.from(allowedKeys),
      },
    },
  });
  if (deleteResult.count > 0) {
    console.log(`[x] Cleaned up ${deleteResult.count} obsolete/sensitive keys from database.`);
  }

  const allConfigs = await prisma.systemConfig.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
    select: { key: true, category: true, isPublic: true, value: true, description: true },
  });

  console.log(`\n============================ SUMMARY ============================`);
  console.log(`Total configs in DB: ${allConfigs.length}`);
  console.log(`Upserted configs: ${upserted}`);
  const categories = Array.from(new Set(allConfigs.map((c) => c.category)));
  for (const cat of categories) {
    const inCat = allConfigs.filter((c) => c.category === cat);
    console.log(`Category [${cat}]: ${inCat.length} configs`);
  }
}

main()
  .catch((err) => {
    console.error("Sync error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
