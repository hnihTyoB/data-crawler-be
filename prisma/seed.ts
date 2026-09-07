import {
  PrismaClient,
  UserRole,
  CrawlMode,
  CrawlJobStatus,
  CrawlPageStatus,
  LogLevel,
  ScheduleFrequency,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  SYSTEM_ROLE_SLUGS,
  SYSTEM_ROLES_METADATA,
  SystemRoleSlug,
} from "../src/common/constants/system-role.constant";
import {
  SYSTEM_PERMISSIONS_CATALOG,
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
} from "../src/common/constants/permission.constant";

const prisma = new PrismaClient();

async function seedPermissions(): Promise<Map<string, string>> {
  console.log("Seeding system permissions...");
  const permissionMap = new Map<string, string>(); // slug -> id

  for (const perm of SYSTEM_PERMISSIONS_CATALOG) {
    const record = await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: {
        name: perm.name,
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        isSystem: perm.isSystem,
      },
      create: {
        name: perm.name,
        slug: perm.slug,
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        isSystem: perm.isSystem,
      },
    });
    permissionMap.set(record.slug, record.id);
  }

  return permissionMap;
}

async function seedRoles(
  permissionMap: Map<string, string>,
): Promise<Map<string, string>> {
  console.log("Seeding system roles & binding permissions...");
  const roleMap = new Map<string, string>(); // slug -> id

  for (const slug of Object.values(SYSTEM_ROLE_SLUGS)) {
    const meta = SYSTEM_ROLES_METADATA[slug as SystemRoleSlug];
    const role = await prisma.role.upsert({
      where: { slug },
      update: {
        name: meta.name,
        description: meta.description,
        isSystem: meta.isSystem,
        isActive: true,
      },
      create: {
        name: meta.name,
        slug: meta.slug,
        description: meta.description,
        isSystem: meta.isSystem,
        isActive: true,
      },
    });
    roleMap.set(role.slug, role.id);

    // Bind default permissions
    const defaultPermSlugs =
      SYSTEM_ROLE_DEFAULT_PERMISSIONS[slug as SystemRoleSlug] || [];
    for (const permSlug of defaultPermSlugs) {
      const permId = permissionMap.get(permSlug);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }

  return roleMap;
}

async function seedUsers(roleMap: Map<string, string>) {
  console.log("Seeding base users and user role assignments...");
  const adminPasswordHash = await bcrypt.hash("Admin@123456", 10);
  const crawlerPasswordHash = await bcrypt.hash("Crawler@123456", 10);
  const viewerPasswordHash = await bcrypt.hash("Viewer@123456", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@crawl.local" },
    update: {},
    create: {
      email: "admin@crawl.local",
      passwordHash: adminPasswordHash,
      fullName: "System Super Admin",
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const crawlerUser = await prisma.user.upsert({
    where: { email: "crawl@crawl.local" },
    update: {},
    create: {
      email: "crawl@crawl.local",
      passwordHash: crawlerPasswordHash,
      fullName: "Crawl User",
      role: UserRole.CRAWLER_USER,
      isActive: true,
      maxPagesLimit: 100,
      maxJobsPerDayLimit: 10,
      maxConcurrentJobsLimit: 3,
    },
  });

  const viewerUser = await prisma.user.upsert({
    where: { email: "viewer@crawl.local" },
    update: {},
    create: {
      email: "viewer@crawl.local",
      passwordHash: viewerPasswordHash,
      fullName: "Viewer User",
      role: UserRole.VIEWER,
      isActive: true,
      maxPagesLimit: 20,
      maxJobsPerDayLimit: 2,
      maxConcurrentJobsLimit: 1,
    },
  });

  // Assign roles
  const superAdminRoleId = roleMap.get(SYSTEM_ROLE_SLUGS.SUPER_ADMIN);
  const adminRoleId = roleMap.get(SYSTEM_ROLE_SLUGS.ADMIN);
  const crawlerRoleId = roleMap.get(SYSTEM_ROLE_SLUGS.CRAWLER_USER);
  const viewerRoleId = roleMap.get(SYSTEM_ROLE_SLUGS.VIEWER);

  if (adminRoleId) {
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: { userId: adminUser.id, roleId: adminRoleId },
      },
      update: {},
      create: { userId: adminUser.id, roleId: adminRoleId },
    });
  }

  if (superAdminRoleId) {
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: { userId: adminUser.id, roleId: superAdminRoleId },
      },
      update: {},
      create: { userId: adminUser.id, roleId: superAdminRoleId },
    });
  }

  if (crawlerRoleId) {
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: { userId: crawlerUser.id, roleId: crawlerRoleId },
      },
      update: {},
      create: { userId: crawlerUser.id, roleId: crawlerRoleId },
    });
  }

  if (viewerRoleId) {
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: { userId: viewerUser.id, roleId: viewerRoleId },
      },
      update: {},
      create: { userId: viewerUser.id, roleId: viewerRoleId },
    });
  }

  // Backfill existing users in database
  console.log("Backfilling legacy users into UserRoleAssignment...");
  const allUsers = await prisma.user.findMany({
    include: { userRoles: true },
  });

  for (const user of allUsers) {
    if (user.userRoles.length === 0) {
      let targetRoleId: string | undefined;
      if (user.role === UserRole.ADMIN) {
        targetRoleId = adminRoleId;
      } else if (user.role === UserRole.VIEWER) {
        targetRoleId = viewerRoleId;
      } else {
        targetRoleId = crawlerRoleId;
      }

      if (targetRoleId) {
        await prisma.userRoleAssignment.upsert({
          where: {
            userId_roleId: { userId: user.id, roleId: targetRoleId },
          },
          update: {},
          create: { userId: user.id, roleId: targetRoleId },
        });
      }
    }
  }
}

async function seedExtractionTemplates(userId: string) {
  console.log("Seeding extraction templates...");
  const templates = [
    {
      name: "Trích xuất Tin tức Báo chí (News/Article)",
      domain: "vnexpress.net",
      fields: [
        { name: "title", selector: "h1.title-detail", attr: "text", required: true },
        { name: "description", selector: "p.description", attr: "text", required: false },
        { name: "content", selector: "article.fck_detail", attr: "text", required: true },
        { name: "author", selector: ".author-name", attr: "text", required: false },
        { name: "publishedAt", selector: "span.date", attr: "text", required: false },
      ],
    },
    {
      name: "Trích xuất Sản phẩm E-Commerce (Tiki/Shopee)",
      domain: "tiki.vn",
      fields: [
        { name: "productName", selector: "h1.title", attr: "text", required: true },
        { name: "price", selector: ".product-price__current-price", attr: "text", required: true },
        { name: "originalPrice", selector: ".product-price__original-price", attr: "text", required: false },
        { name: "rating", selector: ".rating-stars", attr: "text", required: false },
        { name: "thumbnail", selector: ".thumbnail img", attr: "src", required: false },
      ],
    },
    {
      name: "Trích xuất Danh bạ Doanh nghiệp Toàn quốc",
      domain: "yellowpages.vn",
      fields: [
        { name: "companyName", selector: ".company-name", attr: "text", required: true },
        { name: "phone", selector: ".phone-number", attr: "text", required: true },
        { name: "address", selector: ".company-address", attr: "text", required: true },
        { name: "taxCode", selector: ".tax-code", attr: "text", required: false },
      ],
    },
  ];

  for (const tpl of templates) {
    await prisma.extractionTemplate.upsert({
      where: {
        userId_domain: {
          userId,
          domain: tpl.domain,
        },
      },
      update: {
        name: tpl.name,
        fields: tpl.fields,
      },
      create: {
        userId,
        name: tpl.name,
        domain: tpl.domain,
        fields: tpl.fields,
      },
    });
  }
}

async function seedCrawlSchedules(userId: string) {
  console.log("Seeding crawl schedules...");
  const schedules = [
    {
      name: "Cào tin tức công nghệ & AI buổi sáng",
      startUrl: "https://vnexpress.net/so-hoa/cong-nghe",
      domain: "vnexpress.net",
      mode: CrawlMode.CRAWL,
      frequency: ScheduleFrequency.DAILY,
      cronExpression: "0 6 * * *",
      hour: 6,
      minute: 0,
      maxPages: 50,
      maxDepth: 2,
      isActive: true,
      autoDiff: true,
    },
    {
      name: "Theo dõi biến động giá laptop hàng tuần",
      startUrl: "https://tiki.vn/laptop/c8095",
      domain: "tiki.vn",
      mode: CrawlMode.SCRAPE,
      frequency: ScheduleFrequency.WEEKLY,
      cronExpression: "0 12 * * 1",
      hour: 12,
      minute: 0,
      maxPages: 30,
      maxDepth: 1,
      isActive: true,
      autoDiff: true,
    },
  ];

  for (const item of schedules) {
    const existing = await prisma.crawlSchedule.findFirst({
      where: { userId, name: item.name },
    });
    if (!existing) {
      await prisma.crawlSchedule.create({
        data: {
          userId,
          ...item,
        },
      });
    }
  }
}

async function seedCrawlJobsAndPages(userId: string) {
  console.log("Seeding realistic sample Crawl Jobs, Pages, and Logs...");

  // Job 1: COMPLETED (52 pages crawled, 49 success, 3 failed)
  const job1Id = "088f635c-9c3a-4467-93bb-e58f001bf001";
  const job1 = await prisma.crawlJob.upsert({
    where: { id: job1Id },
    update: {
      status: CrawlJobStatus.COMPLETED,
      totalPages: 52,
      successPages: 49,
      failedPages: 3,
      startedAt: new Date(Date.now() - 3600000 * 1.5),
      finishedAt: new Date(Date.now() - 3600000 * 0.5),
    },
    create: {
      id: job1Id,
      userId,
      startUrl: "https://vnexpress.net/so-hoa/cong-nghe",
      domain: "vnexpress.net",
      mode: CrawlMode.CRAWL,
      status: CrawlJobStatus.COMPLETED,
      maxPages: 100,
      maxDepth: 3,
      urls: [],
      totalPages: 52,
      successPages: 49,
      failedPages: 3,
      timeoutMs: 30000,
      retryCount: 3,
      respectRobotsTxt: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      delayMs: 1000,
      startedAt: new Date(Date.now() - 3600000 * 1.5),
      finishedAt: new Date(Date.now() - 3600000 * 0.5),
      diffSummary: {
        totalCurrentPages: 52,
        totalPreviousPages: 45,
        newPagesCount: 12,
        modifiedPagesCount: 7,
        deletedPagesCount: 2,
        unchangedPagesCount: 33,
        changeRate: 0.4,
      },
    },
  });

  // Pages for Job 1
  const pages = [
    {
      id: "a1111111-1111-4111-8111-111111111111",
      url: "https://vnexpress.net/so-hoa/cong-nghe",
      normalizedUrl: "https://vnexpress.net/so-hoa/cong-nghe",
      title: "Công nghệ - Tin tức công nghệ mới nhất hôm nay",
      description: "Cập nhật nhanh tin tức công nghệ, thiết bị mới, trí tuệ nhân tạo AI và viễn thông.",
      status: CrawlPageStatus.SUCCESS,
      statusCode: 200,
      wordCount: 1420,
      dataQualityScore: 98,
      contentHash: "sha256-a1b2c3d4e5f67890",
      crawledAt: new Date(Date.now() - 3600000),
      markdownContent: "# Tin tức Công nghệ Mới Nhất\n\nThị trường công nghệ toàn cầu ghi nhận làn sóng đột phá về mô hình ngôn ngữ lớn (LLM) và giải pháp điện toán đám mây sinh thái...\n\n## 1. Trí tuệ nhân tạo thế hệ mới\nCác giải pháp AI đang được tối ưu hóa nhằm giảm thiểu lượng khí thải carbon và điện năng tiêu thụ tại các trung tâm dữ liệu.\n\n## 2. Thiết bị phần cứng tiết kiệm năng lượng\nChip xử lý tiến trình 3nm mang lại hiệu suất vượt trội mà vẫn giữ được nhiệt độ vận hành lý tưởng.",
      content: "Thị trường công nghệ toàn cầu ghi nhận làn sóng đột phá về AI...",
    },
    {
      id: "a2222222-2222-4222-8222-222222222222",
      url: "https://vnexpress.net/so-hoa/ai-tiet-kiem-nang-luong-4712345.html",
      normalizedUrl: "https://vnexpress.net/so-hoa/ai-tiet-kiem-nang-luong-4712345.html",
      title: "Giải pháp AI xanh giúp giảm 40% điện năng trung tâm dữ liệu",
      description: "Các kỹ sư phát triển thuật toán điều phối thông minh giúp trung tâm dữ liệu xanh hóa quy trình xử lý.",
      status: CrawlPageStatus.SUCCESS,
      statusCode: 200,
      wordCount: 2150,
      dataQualityScore: 95,
      contentHash: "sha256-b2c3d4e5f6a78901",
      crawledAt: new Date(Date.now() - 3200000),
      markdownContent: "# Giải pháp AI xanh giúp giảm 40% điện năng trung tâm dữ liệu\n\nNghiên cứu mới công bố cho thấy việc áp dụng cơ chế suy luận lượng tử hóa và caching thông minh đã cắt giảm mạnh mức tiêu thụ điện của các cụm máy chủ GPU.\n\n> Đổi mới sáng tạo cần đi đôi với bảo vệ môi trường và phát triển bền vững.",
      content: "Nghiên cứu mới công bố cho thấy việc áp dụng cơ chế suy luận lượng tử hóa...",
    },
    {
      id: "a3333333-3333-4333-8333-333333333333",
      url: "https://vnexpress.net/so-hoa/vi-xu-ly-the-he-moi-4712399.html",
      normalizedUrl: "https://vnexpress.net/so-hoa/vi-xu-ly-the-he-moi-4712399.html",
      title: "Thế hệ vi xử lý bán dẫn 2nm đầu tiên chuẩn bị thương mại hóa",
      description: "Các nhà máy đúc chip hàng đầu thế giới công bố tiến độ thương mại hóa chip 2nm vào cuối năm.",
      status: CrawlPageStatus.SUCCESS,
      statusCode: 200,
      wordCount: 1890,
      dataQualityScore: 92,
      contentHash: "sha256-c3d4e5f6a7b89012",
      crawledAt: new Date(Date.now() - 2700000),
      markdownContent: "# Thế hệ vi xử lý bán dẫn 2nm đầu tiên chuẩn bị thương mại hóa\n\nTiến trình 2nm sử dụng cấu trúc bóng bán dẫn GAA (Gate-All-Around) hứa hẹn tăng 15% hiệu năng và tiết kiệm 30% năng lượng.",
      content: "Tiến trình 2nm sử dụng cấu trúc bóng bán dẫn GAA...",
    },
    {
      id: "a4444444-4444-4444-8444-444444444444",
      url: "https://vnexpress.net/so-hoa/khong-tim-thay-trang-cu.html",
      normalizedUrl: "https://vnexpress.net/so-hoa/khong-tim-thay-trang-cu.html",
      title: "Trang không tồn tại (404 Not Found)",
      description: null,
      status: CrawlPageStatus.FAILED,
      statusCode: 404,
      wordCount: 45,
      dataQualityScore: 0,
      contentHash: null,
      errorMessage: "Mã trạng thái HTTP 404 Not Found",
      crawledAt: new Date(Date.now() - 2100000),
      markdownContent: "# 404 Not Found\n\nTrang bạn tìm kiếm không tồn tại hoặc đã bị gỡ bỏ.",
      content: "404 Not Found",
    },
  ];

  for (const p of pages) {
    await prisma.crawlPage.upsert({
      where: {
        jobId_url: {
          jobId: job1.id,
          url: p.url,
        },
      },
      update: {
        title: p.title,
        status: p.status,
        statusCode: p.statusCode,
        wordCount: p.wordCount,
        contentHash: p.contentHash,
        markdownContent: p.markdownContent,
      },
      create: {
        id: p.id,
        jobId: job1.id,
        ...p,
      },
    });
  }

  // Logs for Job 1
  const logs = [
    { level: LogLevel.INFO, step: "INIT", message: "Khởi tạo tiến trình cào dữ liệu cho tác vụ. Đã nạp cấu hình bộ thu thập." },
    { level: LogLevel.INFO, step: "ROBOTS_TXT", message: "Tải và phân tích robots.txt: Crawl-Delay 1.0s, Allow: /*." },
    { level: LogLevel.INFO, step: "DISPATCH", message: "Phân phối URL gốc vào hàng đợi Redis/BullMQ: https://vnexpress.net/so-hoa/cong-nghe" },
    { level: LogLevel.INFO, step: "SCRAPING", message: "HTTP 200 OK: Đã tải về thành công DOM HTML (142.4 KB, 238ms)." },
    { level: LogLevel.WARNING, step: "CONTENT_CLEAN", message: "Phát hiện mã theo dõi quảng cáo bên thứ ba. Đã loại bỏ thành công." },
    { level: LogLevel.ERROR, step: "NETWORK", message: "HTTP 404 Not Found: Bỏ qua đường dẫn /tin-cu/bai-viet-da-xoa.html sau 3 lần thử." },
    { level: LogLevel.INFO, step: "STREAM", message: "Đồng bộ tiến độ qua SSE Event: 52/100 trang đã xử lý (52% hoàn tất)." },
  ];

  for (const l of logs) {
    await prisma.crawlJobLog.create({
      data: {
        jobId: job1.id,
        level: l.level,
        step: l.step,
        message: l.message,
      },
    });
  }

  // Job 2: COMPLETED
  const job2Id = "199a746d-ad4b-5578-84cc-f69a112cf002";
  await prisma.crawlJob.upsert({
    where: { id: job2Id },
    update: {},
    create: {
      id: job2Id,
      userId,
      startUrl: "https://tiki.vn/laptop/c8095",
      domain: "tiki.vn",
      mode: CrawlMode.SCRAPE,
      status: CrawlJobStatus.COMPLETED,
      maxPages: 50,
      maxDepth: 2,
      urls: [],
      totalPages: 50,
      successPages: 50,
      failedPages: 0,
      timeoutMs: 30000,
      retryCount: 3,
      respectRobotsTxt: true,
      userAgent: "DataCrawler-Bot/2.0 (+https://datacrawler.internal)",
      delayMs: 1500,
      startedAt: new Date(Date.now() - 3600000 * 12),
      finishedAt: new Date(Date.now() - 3600000 * 11),
      diffSummary: {
        totalCurrentPages: 50,
        totalPreviousPages: 48,
        newPagesCount: 5,
        modifiedPagesCount: 18,
        deletedPagesCount: 3,
        unchangedPagesCount: 27,
        changeRate: 0.54,
      },
    },
  });

  // Job 3: CANCELED
  const job3Id = "2aab857e-be5c-6689-95dd-07ab223df003";
  await prisma.crawlJob.upsert({
    where: { id: job3Id },
    update: {},
    create: {
      id: job3Id,
      userId,
      startUrl: "https://yellowpages.vn/danh-ba-doanh-nghiep",
      domain: "yellowpages.vn",
      mode: CrawlMode.CRAWL,
      status: CrawlJobStatus.CANCELED,
      maxPages: 200,
      maxDepth: 2,
      urls: [],
      totalPages: 84,
      successPages: 82,
      failedPages: 2,
      errorMessage: "Tác vụ bị hủy bỏ theo yêu cầu của người dùng",
      startedAt: new Date(Date.now() - 3600000 * 24),
      finishedAt: new Date(Date.now() - 3600000 * 23.5),
    },
  });

  // Job 4: FAILED
  const job4Id = "3bbc968f-cf6d-7790-06ee-18bc334ef004";
  await prisma.crawlJob.upsert({
    where: { id: job4Id },
    update: {},
    create: {
      id: job4Id,
      userId,
      startUrl: "https://cafef.vn/tai-chinh-quoc-te",
      domain: "cafef.vn",
      mode: CrawlMode.SCRAPE,
      status: CrawlJobStatus.FAILED,
      maxPages: 40,
      maxDepth: 1,
      urls: [],
      totalPages: 12,
      successPages: 6,
      failedPages: 6,
      errorMessage: "Mục tiêu phản hồi HTTP 403 Forbidden (Cloudflare bot protection triggered)",
      startedAt: new Date(Date.now() - 3600000 * 48),
      finishedAt: new Date(Date.now() - 3600000 * 47.9),
    },
  });

  // Job 5: PENDING
  const job5Id = "4ccd0790-d07e-8801-17ff-29cd445ff005";
  await prisma.crawlJob.upsert({
    where: { id: job5Id },
    update: {},
    create: {
      id: job5Id,
      userId,
      startUrl: "https://genk.vn/tin-ict.chn",
      domain: "genk.vn",
      mode: CrawlMode.CRAWL,
      status: CrawlJobStatus.PENDING,
      maxPages: 80,
      maxDepth: 2,
      urls: [],
      totalPages: 0,
      successPages: 0,
      failedPages: 0,
    },
  });
}

async function main() {
  const permissionMap = await seedPermissions();
  const roleMap = await seedRoles(permissionMap);
  await seedUsers(roleMap);

  const crawlerUser = await prisma.user.findUnique({
    where: { email: "crawl@crawl.local" },
  });

  if (crawlerUser) {
    await seedExtractionTemplates(crawlerUser.id);
    await seedCrawlSchedules(crawlerUser.id);
    await seedCrawlJobsAndPages(crawlerUser.id);
  }

  console.log("Seed completed successfully with full sample data!");
}

main()
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
