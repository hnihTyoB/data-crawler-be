export const swaggerPaths: Record<string, any> = {
  "/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Đăng nhập người dùng",
      description:
        "Xác thực email và mật khẩu để nhận Access Token và Refresh Token.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/LoginRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Đăng nhập thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      accessToken: { type: "string" },
                      refreshToken: { type: "string" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "Dữ liệu yêu cầu không hợp lệ" },
        401: { description: "Email hoặc mật khẩu không chính xác" },
      },
    },
  },
  "/auth/refresh": {
    post: {
      tags: ["Auth"],
      summary: "Làm mới Access Token",
      description: "Sử dụng Refresh Token hợp lệ để cấp mới Access Token.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RefreshRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Làm mới token thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      accessToken: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Refresh token không hợp lệ hoặc hết hạn" },
      },
    },
  },
  "/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "Đăng xuất",
      description: "Hủy bỏ Refresh Token và đăng xuất khỏi hệ thống.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/LogoutRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Đăng xuất thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Logged out successfully",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Lấy thông tin người dùng hiện tại",
      description:
        "Lấy thông tin cá nhân của tài khoản đang đăng nhập qua token.",
      responses: {
        200: {
          description: "Lấy thông tin thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực hoặc token không hợp lệ" },
      },
    },
    put: {
      tags: ["Auth"],
      summary: "Cập nhật thông tin cá nhân",
      description: "Cập nhật họ tên của người dùng hiện tại.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateMeRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Cập nhật thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
        400: { description: "Dữ liệu yêu cầu không hợp lệ" },
        401: { description: "Chưa xác thực" },
      },
    },
  },
  "/auth/me/usage": {
    get: {
      tags: ["Auth"],
      summary: "Xem hạn mức và mức độ sử dụng Quota hiện tại",
      description:
        "Trả về số job đã chạy hôm nay theo giờ Việt Nam UTC+7, số job đồng thời đang chạy và tổng trang đã crawl.",
      responses: {
        200: {
          description: "Lấy quota và usage thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      quota: {
                        type: "object",
                        properties: {
                          maxPagesLimit: { type: "integer", example: 100 },
                          maxJobsPerDayLimit: { type: "integer", example: 10 },
                          maxConcurrentJobsLimit: {
                            type: "integer",
                            example: 3,
                          },
                        },
                      },
                      usage: {
                        type: "object",
                        properties: {
                          jobsUsedToday: { type: "integer", example: 2 },
                          jobsRemainingToday: { type: "integer", example: 8 },
                          concurrentJobsRunning: {
                            type: "integer",
                            example: 0,
                          },
                          concurrentJobsAvailable: {
                            type: "integer",
                            example: 3,
                          },
                          totalPagesCrawled: { type: "integer", example: 45 },
                        },
                      },
                      resetAt: {
                        type: "string",
                        example: "2026-09-04T00:00:00.000Z",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
      },
    },
  },
  "/auth/change-password": {
    post: {
      tags: ["Auth"],
      summary: "Đổi mật khẩu tài khoản",
      description:
        "Thay đổi mật khẩu cho người dùng hiện tại đang đăng nhập. Yêu cầu nhập mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ChangePasswordRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Đổi mật khẩu thành công và cấp lại token mới",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Password changed successfully",
                  },
                },
              },
            },
          },
        },
        400: {
          description:
            "Mật khẩu hiện tại không đúng hoặc mật khẩu mới không hợp lệ",
        },
        401: { description: "Chưa xác thực" },
      },
    },
  },
  "/auth/register": {
    post: {
      tags: ["Auth"],
      summary: "Đăng ký tài khoản mới",
      description:
        "Tạo tài khoản người dùng mới (mặc định vai trò CRAWLER_USER). Tài khoản sẽ được tạo ở trạng thái inactive cho đến khi xác thực email.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RegisterRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Đăng ký thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
        400: { description: "Email đã được sử dụng hoặc dữ liệu không hợp lệ" },
      },
    },
  },
  "/auth/resend-verification": {
    post: {
      tags: ["Auth"],
      summary: "Gửi lại email xác thực",
      description:
        "Gửi lại liên kết xác thực cho người dùng đã đăng ký nhưng chưa xác thực email.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ResendVerificationRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Yêu cầu gửi lại email xác thực đã được xử lý",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example:
                      "Nếu email đã đăng ký và chưa được xác thực, liên kết xác thực đã được gửi.",
                  },
                },
              },
            },
          },
        },
        400: { description: "Địa chỉ email không hợp lệ" },
      },
    },
  },
  "/auth/forgot-password": {
    post: {
      tags: ["Auth"],
      summary: "Yêu cầu đặt lại mật khẩu",
      description:
        "Gửi email chứa link đặt lại mật khẩu đến địa chỉ email của người dùng.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email"],
              properties: {
                email: {
                  type: "string",
                  format: "email",
                  example: "user@example.com",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description:
            "Email đặt lại mật khẩu đã được gửi (luôn trả về 200 để tránh lộ thông tin tài khoản)",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "If the email exists, a reset link has been sent.",
                  },
                },
              },
            },
          },
        },
        400: { description: "Email không hợp lệ" },
      },
    },
  },
  "/auth/reset-password": {
    post: {
      tags: ["Auth"],
      summary: "Đặt lại mật khẩu mới",
      description:
        "Sử dụng token trong email để đặt lại mật khẩu mới cho tài khoản.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["token", "password"],
              properties: {
                token: { type: "string", example: "abc123resettoken" },
                password: { type: "string", example: "NewPassword123!" },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Đặt lại mật khẩu thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Password reset successfully.",
                  },
                },
              },
            },
          },
        },
        400: {
          description:
            "Token không hợp lệ, đã hết hạn hoặc mật khẩu không đúng định dạng",
        },
      },
    },
  },
  "/auth/verify-email": {
    post: {
      tags: ["Auth"],
      summary: "Xác thực địa chỉ email",
      description:
        "Xác thực email của người dùng thông qua token được gửi trong email đăng ký.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["token"],
              properties: {
                token: { type: "string", example: "abc123verifytoken" },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Xác thực email thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Email verified successfully.",
                  },
                },
              },
            },
          },
        },
        400: { description: "Token không hợp lệ hoặc đã hết hạn" },
      },
    },
  },
  "/users": {
    get: {
      tags: ["Users"],
      summary: "Lấy danh sách người dùng",
      description:
        "Lấy danh sách phân trang người dùng trong hệ thống. Chỉ có ADMIN mới có quyền truy cập.",
      parameters: [
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
          description: "Số trang cần lấy",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 10 },
          description: "Số lượng bản ghi mỗi trang",
        },
        {
          name: "search",
          in: "query",
          schema: { type: "string" },
          description: "Tìm kiếm theo tên hoặc email",
        },
      ],
      responses: {
        200: {
          description: "Lấy danh sách thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      users: {
                        type: "array",
                        items: { $ref: "#/components/schemas/User" },
                      },
                      meta: {
                        type: "object",
                        properties: {
                          total: { type: "integer" },
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          totalPages: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        403: { description: "Không có quyền truy cập" },
      },
    },
    post: {
      tags: ["Users"],
      summary: "Tạo người dùng mới",
      description:
        "Tạo mới một tài khoản người dùng với các thông tin và giới hạn crawl cụ thể. Chỉ ADMIN có quyền.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateUserRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Tạo tài khoản thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
        400: { description: "Dữ liệu không hợp lệ hoặc email đã tồn tại" },
        401: { description: "Chưa xác thực" },
        403: { description: "Không có quyền truy cập" },
      },
    },
  },
  "/users/{id}": {
    get: {
      tags: ["Users"],
      summary: "Lấy thông tin người dùng theo ID",
      description:
        "Lấy chi tiết thông tin của một người dùng theo ID. Chỉ ADMIN có quyền.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của người dùng (UUID)",
        },
      ],
      responses: {
        200: {
          description: "Lấy thông tin thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
        404: { description: "Không tìm thấy người dùng" },
        401: { description: "Chưa xác thực" },
        403: { description: "Không có quyền truy cập" },
      },
    },
    put: {
      tags: ["Users"],
      summary: "Cập nhật thông tin người dùng",
      description:
        "Cập nhật thông tin chi tiết hoặc giới hạn crawl của người dùng. Chỉ ADMIN có quyền.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của người dùng (UUID)",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateUserRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Cập nhật thông tin thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
        400: { description: "Dữ liệu không hợp lệ" },
        404: { description: "Không tìm thấy người dùng" },
      },
    },
    delete: {
      tags: ["Users"],
      summary: "Xóa người dùng",
      description:
        "Xóa vĩnh viễn tài khoản người dùng khỏi hệ thống. Chỉ ADMIN có quyền.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của người dùng (UUID)",
        },
      ],
      responses: {
        200: {
          description: "Xóa tài khoản thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "User deleted successfully",
                  },
                },
              },
            },
          },
        },
        404: { description: "Không tìm thấy người dùng" },
      },
    },
  },
  "/crawl-jobs": {
    post: {
      tags: ["Crawl Jobs"],
      summary: "Tạo crawl job mới",
      description:
        "Tạo một tác vụ crawl dữ liệu từ URL bắt đầu với các cấu hình về độ sâu và giới hạn trang.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateCrawlJobRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Tạo job thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/CrawlJob" },
                },
              },
            },
          },
        },
        400: {
          description: "Dữ liệu không hợp lệ hoặc vượt quá giới hạn tài khoản",
        },
        401: { description: "Chưa xác thực" },
      },
    },
    get: {
      tags: ["Crawl Jobs"],
      summary: "Lấy danh sách các crawl jobs",
      description:
        "Lấy danh sách phân trang các crawl jobs. USER/VIEWER chỉ xem được job của mình, ADMIN xem được toàn bộ.",
      parameters: [
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
          description: "Số trang cần lấy",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 10 },
          description: "Số lượng bản ghi mỗi trang",
        },
        {
          name: "status",
          in: "query",
          schema: { type: "string" },
          description:
            "Lọc theo trạng thái job (PENDING, RUNNING, COMPLETED, FAILED, CANCELED)",
        },
      ],
      responses: {
        200: {
          description: "Lấy danh sách thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      jobs: {
                        type: "array",
                        items: { $ref: "#/components/schemas/CrawlJob" },
                      },
                      meta: {
                        type: "object",
                        properties: {
                          total: { type: "integer" },
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          totalPages: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/crawl-jobs/{id}": {
    get: {
      tags: ["Crawl Jobs"],
      summary: "Lấy thông tin chi tiết một crawl job",
      description: "Lấy thông tin chi tiết của một job theo ID.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của crawl job",
        },
      ],
      responses: {
        200: {
          description: "Lấy chi tiết thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/CrawlJob" },
                },
              },
            },
          },
        },
        404: {
          description: "Không tìm thấy crawl job hoặc không có quyền truy cập",
        },
      },
    },
  },
  "/crawl-jobs/{id}/cancel": {
    post: {
      tags: ["Crawl Jobs"],
      summary: "Hủy một crawl job đang chạy",
      description: "Hủy một job đang ở trạng thái chờ hoặc đang chạy.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của crawl job",
        },
      ],
      responses: {
        200: {
          description: "Hủy job thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/CrawlJob" },
                },
              },
            },
          },
        },
        400: { description: "Không thể hủy job ở trạng thái hiện tại" },
        404: { description: "Không tìm thấy crawl job" },
      },
    },
  },
  "/crawl-jobs/{id}/pages": {
    get: {
      tags: ["Crawl Jobs"],
      summary: "Lấy danh sách các trang đã crawl của job",
      description:
        "Lấy danh sách phân trang các trang web đã được crawl trong job, hỗ trợ tìm kiếm, lọc theo trạng thái, lọc theo điểm chất lượng và xem preview dữ liệu clean/raw.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của crawl job",
        },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
          description: "Số trang cần lấy",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 10 },
          description: "Số lượng bản ghi mỗi trang",
        },
        {
          name: "status",
          in: "query",
          schema: { type: "string" },
          description:
            "Lọc theo trạng thái trang (SUCCESS, FAILED, BLOCKED...)",
        },
        {
          name: "statusCode",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo mã phản hồi HTTP của trang web",
        },
        {
          name: "search",
          in: "query",
          schema: { type: "string" },
          description: "Tìm kiếm theo URL, tiêu đề hoặc nội dung trang",
        },
        {
          name: "dataQualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu chính xác (0-100)",
        },
        {
          name: "minDataQualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu tối thiểu",
        },
        {
          name: "maxDataQualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu tối đa",
        },
        {
          name: "qualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu chính xác (alias)",
        },
        {
          name: "minQualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu tối thiểu (alias)",
        },
        {
          name: "maxQualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu tối đa (alias)",
        },
        {
          name: "hasImages",
          in: "query",
          schema: { type: "boolean" },
          description: "Lọc các trang có chứa hình ảnh hay không",
        },
        {
          name: "hasLinks",
          in: "query",
          schema: { type: "boolean" },
          description: "Lọc các trang có chứa liên kết hay không",
        },
        {
          name: "hasTables",
          in: "query",
          schema: { type: "boolean" },
          description: "Lọc các trang có chứa bảng dữ liệu hay không",
        },
        {
          name: "contentLength",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ chính xác",
        },
        {
          name: "minContentLength",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ tối thiểu",
        },
        {
          name: "maxContentLength",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ tối đa",
        },
        {
          name: "wordCount",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ chính xác (alias)",
        },
        {
          name: "minWordCount",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ tối thiểu (alias)",
        },
        {
          name: "maxWordCount",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ tối đa (alias)",
        },
        {
          name: "sortBy",
          in: "query",
          schema: {
            type: "string",
            enum: [
              "createdAt",
              "updatedAt",
              "url",
              "title",
              "statusCode",
              "status",
              "crawledAt",
              "dataQualityScore",
              "wordCount",
            ],
            default: "createdAt",
          },
          description: "Trường sắp xếp",
        },
        {
          name: "order",
          in: "query",
          schema: { type: "string", enum: ["asc", "desc"], default: "asc" },
          description: "Thứ tự sắp xếp",
        },
        {
          name: "preview",
          in: "query",
          schema: { type: "boolean", default: false },
          description: "Trả về dữ liệu preview (clean/raw content)",
        },
      ],
      responses: {
        200: {
          description: "Lấy danh sách thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: { $ref: "#/components/schemas/CrawlPage" },
                      },
                      meta: {
                        type: "object",
                        properties: {
                          total: { type: "integer" },
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          totalPages: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/crawl-jobs/{id}/pages/preview": {
    get: {
      tags: ["Crawl Jobs"],
      summary: "Xem preview dữ liệu clean/raw của các trang đã crawl",
      description:
        "Lấy danh sách phân trang kèm theo nội dung preview (rawMarkdown, mainContent, cleanText), hỗ trợ lọc theo trạng thái, điểm chất lượng và tìm kiếm trong nội dung chính.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của crawl job",
        },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
          description: "Số trang cần lấy",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 10 },
          description: "Số lượng bản ghi mỗi trang",
        },
        {
          name: "status",
          in: "query",
          schema: { type: "string" },
          description:
            "Lọc theo trạng thái trang (SUCCESS, FAILED, BLOCKED...)",
        },
        {
          name: "statusCode",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo mã phản hồi HTTP của trang web",
        },
        {
          name: "search",
          in: "query",
          schema: { type: "string" },
          description: "Tìm kiếm theo URL, tiêu đề hoặc nội dung trang",
        },
        {
          name: "dataQualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu chính xác (0-100)",
        },
        {
          name: "minDataQualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu tối thiểu",
        },
        {
          name: "maxDataQualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu tối đa",
        },
        {
          name: "qualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu chính xác (alias)",
        },
        {
          name: "minQualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu tối thiểu (alias)",
        },
        {
          name: "maxQualityScore",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo điểm chất lượng dữ liệu tối đa (alias)",
        },
        {
          name: "hasImages",
          in: "query",
          schema: { type: "boolean" },
          description: "Lọc các trang có chứa hình ảnh hay không",
        },
        {
          name: "hasLinks",
          in: "query",
          schema: { type: "boolean" },
          description: "Lọc các trang có chứa liên kết hay không",
        },
        {
          name: "hasTables",
          in: "query",
          schema: { type: "boolean" },
          description: "Lọc các trang có chứa bảng dữ liệu hay không",
        },
        {
          name: "contentLength",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ chính xác",
        },
        {
          name: "minContentLength",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ tối thiểu",
        },
        {
          name: "maxContentLength",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ tối đa",
        },
        {
          name: "wordCount",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ chính xác (alias)",
        },
        {
          name: "minWordCount",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ tối thiểu (alias)",
        },
        {
          name: "maxWordCount",
          in: "query",
          schema: { type: "integer" },
          description: "Lọc theo số lượng từ tối đa (alias)",
        },
        {
          name: "sortBy",
          in: "query",
          schema: {
            type: "string",
            enum: [
              "createdAt",
              "updatedAt",
              "url",
              "title",
              "statusCode",
              "status",
              "crawledAt",
              "dataQualityScore",
              "wordCount",
            ],
            default: "createdAt",
          },
          description: "Trường sắp xếp",
        },
        {
          name: "order",
          in: "query",
          schema: { type: "string", enum: ["asc", "desc"], default: "asc" },
          description: "Thứ tự sắp xếp",
        },
      ],
      responses: {
        200: {
          description: "Lấy danh sách preview thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string", format: "uuid" },
                            jobId: { type: "string", format: "uuid" },
                            url: { type: "string", format: "uri" },
                            normalizedUrl: { type: "string", format: "uri" },
                            title: { type: "string", nullable: true },
                            description: { type: "string", nullable: true },
                            status: { type: "string" },
                            statusCode: { type: "integer", nullable: true },
                            errorMessage: { type: "string", nullable: true },
                            hasSensitiveData: { type: "boolean" },
                            wordCount: { type: "integer" },
                            contentHash: { type: "string", nullable: true },
                            dataQualityScore: {
                              type: "integer",
                              nullable: true,
                            },
                            warnings: {
                              type: "array",
                              items: { type: "string" },
                            },
                            rawMarkdown: {
                              type: "string",
                              nullable: true,
                              description:
                                "Nội dung Markdown thô nguyên bản từ crawler",
                            },
                            mainContent: {
                              type: "string",
                              nullable: true,
                              description:
                                "Nội dung chính đã lọc bỏ nav/footer/sidebar, khuyến nghị cho AI Agent / LLM Ingest",
                            },
                            cleanText: {
                              type: "string",
                              nullable: true,
                              description:
                                "Nội dung plain text thuần túy đã xóa toàn bộ ký tự Markdown",
                            },
                            crawledAt: {
                              type: "string",
                              format: "date-time",
                              nullable: true,
                            },
                          },
                        },
                      },
                      meta: {
                        type: "object",
                        properties: {
                          total: { type: "integer" },
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          totalPages: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        404: {
          description: "Không tìm thấy crawl job hoặc không có quyền truy cập",
        },
      },
    },
  },
  "/crawl-jobs/{id}/assets": {
    get: {
      tags: ["Crawl Jobs"],
      summary: "Lấy danh sách assets của job (có phân trang)",
      description:
        "Lấy danh sách phân trang các assets (IMAGE, LINK, PDF...) đã được thu thập trong job. Hỗ trợ lọc theo loại asset.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của crawl job",
        },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
          description: "Số trang cần lấy",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 50 },
          description: "Số lượng bản ghi mỗi trang (tối đa 500)",
        },
        {
          name: "assetType",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: ["IMAGE", "LINK", "PDF", "FILE", "VIDEO", "OTHER"],
          },
          description: "Lọc theo loại asset",
        },
      ],
      responses: {
        200: {
          description: "Lấy danh sách assets thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            pageId: { type: "string", nullable: true },
                            crawlJobId: { type: "string" },
                            assetType: {
                              type: "string",
                              enum: [
                                "IMAGE",
                                "LINK",
                                "PDF",
                                "FILE",
                                "VIDEO",
                                "OTHER",
                              ],
                            },
                            url: { type: "string" },
                            altText: { type: "string", nullable: true },
                            mimeType: { type: "string", nullable: true },
                            createdAt: { type: "string", format: "date-time" },
                          },
                        },
                      },
                      meta: {
                        type: "object",
                        properties: {
                          page: { type: "integer" },
                          limit: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "assetType không hợp lệ" },
        401: { description: "Chưa xác thực" },
        404: {
          description: "Không tìm thấy crawl job hoặc không có quyền truy cập",
        },
      },
    },
  },
  "/crawl-jobs/{id}/exports": {
    get: {
      tags: ["Crawl Jobs"],
      summary: "Lấy danh sách các bản export của job",
      description: "Lấy các tệp dữ liệu đã được xuất từ job này.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của crawl job",
        },
      ],
      responses: {
        200: {
          description: "Lấy danh sách export thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/CrawlExport" },
                  },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Crawl Jobs"],
      summary: "Yêu cầu xuất dữ liệu cho job",
      description:
        "Yêu cầu xuất dữ liệu đã crawl của job ra định dạng CSV, JSON, XLSX, MARKDOWN hoặc ZIP.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của crawl job",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateExportRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Tạo yêu cầu export thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/CrawlExport" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/crawl-jobs/{id}/download": {
    get: {
      tags: ["Crawl Jobs"],
      summary: "Tải xuống file export mới nhất",
      description:
        "Tải xuống tệp dữ liệu đã xuất mới nhất của crawl job dưới dạng file binary.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của crawl job",
        },
      ],
      responses: {
        200: {
          description: "Trả về file binary để tải xuống",
          headers: {
            "Content-Disposition": {
              type: "string",
              description: "attachment; filename=export.json",
            },
          },
        },
      },
    },
  },
  "/exports/{exportId}/download": {
    get: {
      tags: ["Crawl Exports"],
      summary: "Tải xuống tệp export theo ID",
      description: "Tải xuống tệp dữ liệu đã xuất cụ thể theo ID của tệp.",
      parameters: [
        {
          name: "exportId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của file export",
        },
      ],
      responses: {
        200: {
          description: "Trả về file binary để tải xuống",
          headers: {
            "Content-Disposition": {
              type: "string",
              description: "attachment; filename=export.json",
            },
          },
        },
        404: { description: "Không tìm thấy file export" },
      },
    },
  },
  "/audit-logs": {
    get: {
      tags: ["Audit Logs"],
      summary: "Lấy danh sách nhật ký hệ thống",
      description:
        "Lấy danh sách phân trang các hành động được ghi nhật ký trong hệ thống. Chỉ có ADMIN mới có quyền truy cập.",
      parameters: [
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
          description: "Số trang cần lấy",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 10 },
          description: "Số lượng bản ghi mỗi trang",
        },
        {
          name: "userId",
          in: "query",
          schema: { type: "string" },
          description: "Lọc theo ID người dùng",
        },
        {
          name: "action",
          in: "query",
          schema: { type: "string" },
          description: "Lọc theo loại hành động (CREATE_JOB, CANCEL_JOB...)",
        },
      ],
      responses: {
        200: {
          description: "Lấy danh sách thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      logs: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            userId: { type: "string" },
                            action: { type: "string" },
                            ipAddress: { type: "string" },
                            userAgent: { type: "string" },
                            details: { type: "object" },
                            createdAt: { type: "string" },
                          },
                        },
                      },
                      meta: {
                        type: "object",
                        properties: {
                          total: { type: "integer" },
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          totalPages: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        403: { description: "Không có quyền truy cập (không phải ADMIN)" },
      },
    },
  },
  "/api-keys": {
    post: {
      tags: ["API Keys"],
      security: [{ BearerAuth: [] }],
      summary: "Tạo API Key mới",
      description:
        "Tạo một API key mới cho tài khoản người dùng để gọi API từ bên ngoài. Lưu ý: giá trị raw API key (`rawKey`) chỉ trả về một lần duy nhất tại đây.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateApiKeyRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Tạo thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/ApiKeyWithRaw" },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        422: {
          description:
            "Dữ liệu không hợp lệ hoặc thời điểm hết hạn không ở trong tương lai",
        },
      },
    },
    get: {
      tags: ["API Keys"],
      security: [{ BearerAuth: [] }],
      summary: "Danh sách API Keys",
      description:
        "Lấy danh sách tất cả các API key đã tạo của người dùng (không trả về hash vì lý do bảo mật).",
      responses: {
        200: {
          description: "Lấy danh sách thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ApiKey" },
                  },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
      },
    },
  },
  "/api-keys/{id}": {
    patch: {
      tags: ["API Keys"],
      security: [{ BearerAuth: [] }],
      summary: "Bật hoặc tắt API Key",
      description:
        "Thay đổi trạng thái hoạt động của API key thuộc tài khoản hiện tại.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "ID của API Key",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateApiKeyStatusRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Cập nhật trạng thái thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/ApiKey" },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        404: { description: "Không tìm thấy API Key" },
        422: { description: "Trạng thái không hợp lệ" },
      },
    },
    delete: {
      tags: ["API Keys"],
      security: [{ BearerAuth: [] }],
      summary: "Thu hồi API Key",
      description:
        "Thu hồi vĩnh viễn API key. Key bị xóa ngay và không thể khôi phục.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "ID của API Key cần thu hồi",
        },
      ],
      responses: {
        200: {
          description: "Thu hồi thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/ApiKey" },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        404: { description: "Không tìm thấy API Key" },
      },
    },
  },
  "/webhooks/configs": {
    post: {
      tags: ["Webhooks"],
      summary: "Tạo cấu hình Webhook",
      description:
        "Đăng ký cấu hình Webhook URL nhận callback khi crawl job hoàn thành hoặc thất bại.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateWebhookConfigRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Đăng ký thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/WebhookConfig" },
                },
              },
            },
          },
        },
        400: { description: "Dữ liệu không hợp lệ" },
        401: { description: "Chưa xác thực" },
      },
    },
    get: {
      tags: ["Webhooks"],
      summary: "Xem danh sách Webhook configs",
      description:
        "Lấy toàn bộ danh sách các URL Webhook đã đăng ký nhận callback của người dùng.",
      responses: {
        200: {
          description: "Lấy danh sách thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/WebhookConfig" },
                  },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
      },
    },
  },
  "/webhooks/configs/{id}": {
    delete: {
      tags: ["Webhooks"],
      summary: "Xóa cấu hình Webhook",
      description:
        "Xóa hoàn toàn một cấu hình Webhook nhận callback của người dùng.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của cấu hình Webhook cần xóa",
        },
      ],
      responses: {
        200: {
          description: "Xóa thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/WebhookConfig" },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        404: { description: "Không tìm thấy cấu hình Webhook" },
      },
    },
  },
  "/webhooks/deliveries": {
    get: {
      tags: ["Webhooks"],
      summary: "Xem lịch sử gửi Webhook",
      description:
        "Xem toàn bộ lịch sử gửi webhook (delivery logs) bao gồm các nỗ lực gửi, trạng thái, mã phản hồi và lỗi nếu có.",
      parameters: [
        {
          name: "jobId",
          in: "query",
          schema: { type: "string" },
          description: "Lọc theo ID của crawl job",
        },
        {
          name: "status",
          in: "query",
          schema: { type: "string" },
          description:
            "Lọc theo trạng thái giao nhận (PENDING, SUCCESS, FAILED)",
        },
      ],
      responses: {
        200: {
          description: "Lấy lịch sử thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/WebhookDelivery" },
                  },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
      },
    },
  },
  "/crawl-jobs/{id}/diff": {
    get: {
      tags: ["Crawl Jobs"],
      summary: "Xem báo cáo thay đổi (Diff Report)",
      description:
        "So sánh nội dung crawl hiện tại với lần crawl trước đó để phát hiện các trang MỚI (NEW), THAY ĐỔI (MODIFIED), KHÔNG ĐỔI (UNCHANGED), và BỊ XÓA (DELETED) dựa trên contentHash.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của Crawl Job",
        },
        {
          name: "compareWithJobId",
          in: "query",
          schema: { type: "string" },
          description:
            "ID của Crawl Job muốn so sánh cùng (nếu để trống, hệ thống tự tìm job crawl trước đó)",
        },
      ],
      responses: {
        200: {
          description: "Lấy báo cáo thay đổi thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { $ref: "#/components/schemas/DiffReport" },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        404: { description: "Không tìm thấy crawl job" },
      },
    },
  },
  "/crawl-jobs/{id}/diff/download": {
    get: {
      tags: ["Crawl Jobs"],
      summary: "Tải file diff_report.json",
      description:
        "Tải trực tiếp file diff_report.json dưới dạng file đính kèm.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của Crawl Job",
        },
        {
          name: "compareWithJobId",
          in: "query",
          schema: { type: "string" },
          description: "ID của Crawl Job muốn so sánh cùng",
        },
      ],
      responses: {
        200: {
          description: "Tải file thành công",
          content: {
            "application/json": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        404: { description: "Không tìm thấy crawl job hoặc diff report" },
      },
    },
  },
  "/crawl-schedules": {
    post: {
      tags: ["Crawl Schedules"],
      summary: "Tạo lịch crawl định kỳ mới",
      description:
        "Tạo lịch crawl định kỳ theo ngày (DAILY), tuần (WEEKLY), tháng (MONTHLY) hoặc biểu thức Cron tùy chỉnh (CUSTOM). Tự động tính toán thời gian chạy tiếp theo.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateCrawlScheduleRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Tạo lịch crawl thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/CrawlSchedule" },
                },
              },
            },
          },
        },
        400: { description: "Dữ liệu yêu cầu không hợp lệ" },
        401: { description: "Chưa xác thực" },
      },
    },
    get: {
      tags: ["Crawl Schedules"],
      summary: "Lấy danh sách lịch crawl định kỳ",
      description:
        "Lấy danh sách các lịch crawl có phân trang và bộ lọc theo trạng thái, tần suất hoặc từ khóa.",
      parameters: [
        {
          name: "search",
          in: "query",
          schema: { type: "string" },
          description: "Tìm kiếm theo tên, startUrl hoặc domain",
        },
        {
          name: "frequency",
          in: "query",
          schema: {
            type: "string",
            enum: ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"],
          },
          description: "Lọc theo tần suất",
        },
        {
          name: "isActive",
          in: "query",
          schema: { type: "boolean" },
          description: "Lọc theo trạng thái kích hoạt",
        },
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
      ],
      responses: {
        200: {
          description: "Lấy danh sách thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: { $ref: "#/components/schemas/CrawlSchedule" },
                  },
                  meta: {
                    type: "object",
                    properties: {
                      total: { type: "integer" },
                      page: { type: "integer" },
                      limit: { type: "integer" },
                      totalPages: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
      },
    },
  },
  "/crawl-schedules/{id}": {
    get: {
      tags: ["Crawl Schedules"],
      summary: "Xem chi tiết lịch crawl",
      description:
        "Xem chi tiết thông tin cấu hình và thời gian chạy tiếp theo của lịch crawl.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của lịch crawl",
        },
      ],
      responses: {
        200: {
          description: "Lấy chi tiết thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CrawlSchedule" },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        404: { description: "Không tìm thấy lịch crawl" },
      },
    },
    patch: {
      tags: ["Crawl Schedules"],
      summary: "Cập nhật lịch crawl",
      description:
        "Cập nhật cấu hình lịch crawl. Hệ thống tự động tính toán lại thời gian chạy tiếp theo (nextRunAt).",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của lịch crawl",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateCrawlScheduleRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Cập nhật thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/CrawlSchedule" },
                },
              },
            },
          },
        },
        400: { description: "Dữ liệu không hợp lệ" },
        401: { description: "Chưa xác thực" },
        404: { description: "Không tìm thấy lịch crawl" },
      },
    },
    delete: {
      tags: ["Crawl Schedules"],
      summary: "Xóa lịch crawl",
      description: "Xóa hoàn toàn một lịch crawl định kỳ.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của lịch crawl",
        },
      ],
      responses: {
        200: {
          description: "Xóa thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    example: "Crawl schedule deleted successfully",
                  },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        404: { description: "Không tìm thấy lịch crawl" },
      },
    },
  },
  "/crawl-schedules/{id}/run": {
    post: {
      tags: ["Crawl Schedules"],
      summary: "Kích hoạt chạy ngay lịch crawl",
      description:
        "Kích hoạt chạy ngay lập tức một lượt crawl từ lịch định kỳ mà không cần chờ đến giờ hẹn.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của lịch crawl",
        },
      ],
      responses: {
        201: {
          description: "Kích hoạt thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    example: "Scheduled crawl triggered successfully",
                  },
                  data: { $ref: "#/components/schemas/CrawlJob" },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        404: { description: "Không tìm thấy lịch crawl" },
      },
    },
  },
  "/crawl-schedules/{id}/history": {
    get: {
      tags: ["Crawl Schedules"],
      summary: "Xem lịch sử các lần chạy của lịch crawl",
      description:
        "Xem danh sách các crawl job đã được tạo và thực thi bởi lịch crawl này.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID của lịch crawl",
        },
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
        },
      ],
      responses: {
        200: {
          description: "Lấy lịch sử thành công",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: { $ref: "#/components/schemas/CrawlJob" },
                  },
                  meta: {
                    type: "object",
                    properties: {
                      total: { type: "integer" },
                      page: { type: "integer" },
                      limit: { type: "integer" },
                      totalPages: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Chưa xác thực" },
        404: { description: "Không tìm thấy lịch crawl" },
      },
    },
  },
};
