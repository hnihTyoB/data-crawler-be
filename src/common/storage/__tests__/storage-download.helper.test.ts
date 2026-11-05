import { PassThrough, Readable } from "stream";
import { Response } from "express";
import { StorageFactory } from "../storage.factory";
import { streamStorageDownload } from "../storage-download.helper";
import { IStorageService } from "../storage.interface";

describe("streamStorageDownload", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("pipes the storage stream to the HTTP response with download headers", async () => {
    const storage = {
      exists: jest.fn().mockResolvedValue(true),
      getReadStream: jest
        .fn()
        .mockResolvedValue(Readable.from(["streamed-", "zip"])),
    };
    jest
      .spyOn(StorageFactory, "getStorageService")
      .mockReturnValue(storage as unknown as IStorageService);

    const response = new PassThrough() as PassThrough & {
      setHeader: jest.Mock;
    };
    response.setHeader = jest.fn();
    const chunks: Buffer[] = [];
    response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

    await streamStorageDownload(
      {
        fileName: "large export.zip",
        filePath: "job-1/large.zip",
        fileSize: 12,
        mimeType: "application/zip",
      },
      response as unknown as Response,
    );

    expect(Buffer.concat(chunks).toString()).toBe("streamed-zip");
    expect(storage.getReadStream).toHaveBeenCalledWith("job-1/large.zip");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/zip",
    );
    expect(response.setHeader).toHaveBeenCalledWith("Content-Length", "12");
  });

  it("returns 404 before opening a stream when the object is missing", async () => {
    const storage = {
      exists: jest.fn().mockResolvedValue(false),
      getReadStream: jest.fn(),
    };
    jest
      .spyOn(StorageFactory, "getStorageService")
      .mockReturnValue(storage as unknown as IStorageService);

    await expect(
      streamStorageDownload(
        {
          fileName: "missing.zip",
          filePath: "job-1/missing.zip",
        },
        new PassThrough() as unknown as Response,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(storage.getReadStream).not.toHaveBeenCalled();
  });

  it("sanitizes semicolons and quotes in filename to prevent Content-Disposition parameter injection (SEC-28)", async () => {
    const storage = {
      exists: jest.fn().mockResolvedValue(true),
      getReadStream: jest.fn().mockResolvedValue(Readable.from(["data"])),
    };
    jest
      .spyOn(StorageFactory, "getStorageService")
      .mockReturnValue(storage as unknown as IStorageService);

    const response = new PassThrough() as PassThrough & {
      setHeader: jest.Mock;
    };
    response.setHeader = jest.fn();

    await streamStorageDownload(
      {
        fileName: 'export.zip; filename="malicious.bat"; dummy=.zip',
        filePath: "job-1/export.zip",
      },
      response as unknown as Response,
    );

    // Verify Content-Disposition safeFileName has replaced semicolons and quotes with _
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining('attachment; filename="export.zip_ filename=_malicious.bat__ dummy=.zip"'),
    );
  });
});
