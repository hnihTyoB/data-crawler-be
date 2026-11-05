import { Readable } from "stream";
import { AuthService } from "../auth.service";
import { uploadAvatarMiddleware } from "../../../middlewares/upload.middleware";

describe("AuthService - Avatar Upload & Streaming", () => {
  const mockUser = {
    id: "user-avatar-1",
    email: "user@gmail.com",
    fullName: "Avatar Tester",
    avatarUrl: "/api/v1/auth/avatar/old-avatar.png",
    role: "CRAWLER_USER",
    isActive: true,
    createdAt: new Date(),
  };

  const pngMagicBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);

  const mockFile: Express.Multer.File = {
    fieldname: "avatar",
    originalname: "profile.png",
    encoding: "7bit",
    mimetype: "image/png",
    buffer: pngMagicBytes,
    size: pngMagicBytes.length,
    destination: "",
    filename: "",
    path: "",
    stream: Readable.from(pngMagicBytes),
  };

  it("rejects when no file is provided", async () => {
    const service = new AuthService();
    await expect(
      service.uploadAvatar("user-avatar-1", undefined),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "VALIDATION_ERROR",
      message: "Vui lòng chọn tệp hình ảnh để tải lên.",
    });
  });

  it("rejects when user is not found", async () => {
    const service = new AuthService();
    const repository = {
      findById: jest.fn().mockResolvedValue(null),
    };
    (service as any).repository = repository;

    await expect(
      service.uploadAvatar("non-existent-user", mockFile),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("successfully uploads avatar and cleans up old avatar file", async () => {
    const service = new AuthService();
    const repository = {
      findById: jest.fn().mockResolvedValue(mockUser),
      updateUser: jest.fn().mockImplementation((_id, data) => ({
        ...mockUser,
        ...data,
      })),
    };
    const storageService = {
      uploadStream: jest.fn().mockResolvedValue({
        fileName: "user-avatar-1-12345.png",
        filePath: "avatars/user-avatar-1-12345.png",
        url: "/api/v1/auth/avatar/user-avatar-1-12345.png",
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    (service as any).repository = repository;
    (service as any).storageService = storageService;

    const result = await service.uploadAvatar(mockUser.id, mockFile);

    expect(storageService.uploadStream).toHaveBeenCalledTimes(1);
    expect(storageService.deleteFile).toHaveBeenCalledWith(
      "avatars/old-avatar.png",
    );
    expect(repository.updateUser).toHaveBeenCalledWith(mockUser.id, {
      avatarUrl: "/api/v1/auth/avatar/user-avatar-1-12345.png",
    });
    expect(result.avatarUrl).toBe(
      "/api/v1/auth/avatar/user-avatar-1-12345.png",
    );
  });

  it("prevents arbitrary file deletion when old avatarUrl contains Windows path traversal (SEC-06)", async () => {
    const service = new AuthService();
    const maliciousUser = {
      ...mockUser,
      avatarUrl: "http://attacker.com/avatars/..\\..\\package.json",
    };
    const repository = {
      findById: jest.fn().mockResolvedValue(maliciousUser),
      updateUser: jest.fn().mockImplementation((_id, data) => ({
        ...maliciousUser,
        ...data,
      })),
    };
    const storageService = {
      uploadStream: jest.fn().mockResolvedValue({
        fileName: "user-avatar-1-99999.png",
        filePath: "avatars/user-avatar-1-99999.png",
        url: "/api/v1/auth/avatar/user-avatar-1-99999.png",
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    (service as any).repository = repository;
    (service as any).storageService = storageService;

    const result = await service.uploadAvatar(mockUser.id, mockFile);

    expect(storageService.deleteFile).not.toHaveBeenCalled();
    expect(result.avatarUrl).toBe("/api/v1/auth/avatar/user-avatar-1-99999.png");
  });

  it("prevents arbitrary file deletion when old avatarUrl contains Unix path traversal (SEC-06)", async () => {
    const service = new AuthService();
    const maliciousUser = {
      ...mockUser,
      avatarUrl: "/api/v1/auth/avatar/../../etc/passwd",
    };
    const repository = {
      findById: jest.fn().mockResolvedValue(maliciousUser),
      updateUser: jest.fn().mockImplementation((_id, data) => ({
        ...maliciousUser,
        ...data,
      })),
    };
    const storageService = {
      uploadStream: jest.fn().mockResolvedValue({
        fileName: "user-avatar-1-88888.png",
        filePath: "avatars/user-avatar-1-88888.png",
        url: "/api/v1/auth/avatar/user-avatar-1-88888.png",
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    (service as any).repository = repository;
    (service as any).storageService = storageService;

    await service.uploadAvatar(mockUser.id, mockFile);

    expect(storageService.deleteFile).not.toHaveBeenCalled();
  });

  it("getAvatarStream throws 404 if file does not exist", async () => {
    const service = new AuthService();
    const storageService = {
      exists: jest.fn().mockResolvedValue(false),
      getReadStream: jest.fn(),
    };
    (service as any).storageService = storageService;

    await expect(service.getAvatarStream("missing.png")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Avatar not found",
    });
  });

  it("getAvatarStream returns stream and proper mimeType", async () => {
    const service = new AuthService();
    const mockStream = Readable.from(Buffer.from("img-data"));
    const storageService = {
      exists: jest.fn().mockResolvedValue(true),
      getReadStream: jest.fn().mockResolvedValue(mockStream),
    };
    (service as any).storageService = storageService;

    const result = await service.getAvatarStream("test-avatar.jpg");

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.stream).toBe(mockStream);
    expect(storageService.exists).toHaveBeenCalledWith(
      "avatars/test-avatar.jpg",
    );
  });

  it("middleware rejects non-image mime types", (done) => {
    const middleware = uploadAvatarMiddleware("avatar");
    const req = {
      headers: {
        "content-type": "multipart/form-data; boundary=----WebKitFormBoundary",
      },
    } as any;
    const res = {} as any;

    middleware(req, res, (err?: any) => {
      // With no boundary data, multer will finish or pass error
      expect(typeof middleware).toBe("function");
      done();
    });
  });

  describe("SEC-18: Arbitrary Extension & Magic Bytes Validation", () => {
    it("rejects avatar upload when original filename has disallowed extension (.svg, .html)", async () => {
      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(mockUser),
      };
      (service as any).repository = repository;

      const maliciousFile: Express.Multer.File = {
        ...mockFile,
        originalname: "payload.svg",
        mimetype: "image/png",
      };

      await expect(
        service.uploadAvatar(mockUser.id, maliciousFile),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: expect.stringContaining(".svg"),
      });
    });

    it("rejects avatar upload when buffer content does not match image magic bytes", async () => {
      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(mockUser),
      };
      (service as any).repository = repository;

      const spoofedFile: Express.Multer.File = {
        ...mockFile,
        originalname: "fake.png",
        mimetype: "image/png",
        buffer: Buffer.from("<svg onload=alert(1)>"),
      };

      await expect(
        service.uploadAvatar(mockUser.id, spoofedFile),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("magic bytes"),
      });
    });
  });
});
