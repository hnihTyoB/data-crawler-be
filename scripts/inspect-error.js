require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.crawlJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      startUrl: true,
      status: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  for (const job of jobs) {
    console.log("-----------------------------------------");
    console.log("JOB:", job.id, job.startUrl, job.status);
    console.log("ERROR MESSAGE:", job.errorMessage);
    const logs = await prisma.crawlJobLog.findMany({
      where: { jobId: job.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    console.log("LOGS:", logs.map(l => ({ level: l.level, message: l.message })));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
