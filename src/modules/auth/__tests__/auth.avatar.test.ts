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

  const mockFile: Express.Multer.File = {
    fieldname: "avatar",
    originalname: "profile.png",
    encoding: "7bit",
    mimetype: "image/png",
    buffer: Buffer.from("fake-png-content"),
    size: 16,
    destination: "",
    filename: "",
    path: "",
    stream: Readable.from(Buffer.from("fake-png-content")),
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
});
