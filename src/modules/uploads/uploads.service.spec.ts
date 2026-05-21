import * as fs from "fs";
import { join } from "path";
import { UploadsService } from "./uploads.service";

jest.mock("fs");

const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
const mockStatSync = fs.statSync as jest.MockedFunction<typeof fs.statSync>;
const mockUnlinkSync = fs.unlinkSync as jest.MockedFunction<typeof fs.unlinkSync>;
const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;

describe("UploadsService", () => {
  let service: UploadsService;
  const tempDir = join(process.cwd(), "uploads", "temp");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new UploadsService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // removeTempFile
  // ---------------------------------------------------------------------------
  describe("removeTempFile(filename)", () => {
    it("ควร call unlinkSync ด้วย path ที่ถูกต้อง เมื่อไฟล์มีอยู่", () => {
      // Arrange
      const filename = "test-upload.jpg";
      const expectedPath = join(tempDir, filename);
      mockExistsSync.mockReturnValue(true);

      // Act
      service.removeTempFile(filename);

      // Assert
      expect(mockExistsSync).toHaveBeenCalledWith(expectedPath);
      expect(mockUnlinkSync).toHaveBeenCalledWith(expectedPath);
    });

    it("ไม่ควร call unlinkSync เมื่อไฟล์ไม่มีอยู่", () => {
      // Arrange
      const filename = "ghost-file.jpg";
      mockExistsSync.mockReturnValue(false);

      // Act
      service.removeTempFile(filename);

      // Assert
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it("ควรสร้าง path จาก tempDir และ filename ได้ถูกต้อง", () => {
      // Arrange
      const filename = "subfolder-test.png";
      const expectedPath = join(tempDir, filename);
      mockExistsSync.mockReturnValue(true);

      // Act
      service.removeTempFile(filename);

      // Assert
      expect(mockUnlinkSync).toHaveBeenCalledWith(expectedPath);
      expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // ensureTempDir
  // ---------------------------------------------------------------------------
  describe("ensureTempDir()", () => {
    it("ควร call mkdirSync ด้วย { recursive: true } เมื่อ temp dir ไม่มีอยู่", () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      service.ensureTempDir();

      // Assert
      expect(mockMkdirSync).toHaveBeenCalledWith(tempDir, { recursive: true });
      expect(mockMkdirSync).toHaveBeenCalledTimes(1);
    });

    it("ไม่ควร call mkdirSync เมื่อ temp dir มีอยู่แล้ว", () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);

      // Act
      service.ensureTempDir();

      // Assert
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // cleanupStaleTempFiles (tested via onApplicationBootstrap)
  // ---------------------------------------------------------------------------
  describe("cleanupStaleTempFiles() ผ่าน onApplicationBootstrap()", () => {
    it("กรณี temp dir ไม่มีอยู่ → ไม่ควร throw และไม่ควร call readdirSync", () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act & Assert
      expect(() => service.onApplicationBootstrap()).not.toThrow();
      expect(mockReaddirSync).not.toHaveBeenCalled();
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it("กรณีมี temp dir แต่ไม่มีไฟล์ → ไม่ควร call unlinkSync", () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);

      // Act
      service.onApplicationBootstrap();

      // Assert
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it("กรณีไฟล์อายุ > 24 ชั่วโมง → ควร call unlinkSync ลบไฟล์นั้น", () => {
      // Arrange
      const filename = "stale-file.jpg";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000; // 25 ชั่วโมงที่แล้ว
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([filename] as unknown as ReturnType<typeof fs.readdirSync>);
      mockStatSync.mockReturnValue({ mtimeMs: staleTime } as fs.Stats);

      // Act
      service.onApplicationBootstrap();

      // Assert
      expect(mockUnlinkSync).toHaveBeenCalledWith(join(tempDir, filename));
      expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
    });

    it("กรณีไฟล์อายุ < 24 ชั่วโมง → ไม่ควร call unlinkSync", () => {
      // Arrange
      const filename = "fresh-file.jpg";
      const freshTime = Date.now() - 1 * 60 * 60 * 1000; // 1 ชั่วโมงที่แล้ว
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([filename] as unknown as ReturnType<typeof fs.readdirSync>);
      mockStatSync.mockReturnValue({ mtimeMs: freshTime } as fs.Stats);

      // Act
      service.onApplicationBootstrap();

      // Assert
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it("กรณีไฟล์อายุ = 24 ชั่วโมงพอดี → ไม่ควร delete (not strictly greater than)", () => {
      // Arrange
      const filename = "exactly-24h-file.jpg";
      const maxAge = 24 * 60 * 60 * 1000;
      const now = Date.now();
      // ตั้งค่า mtimeMs ให้ now - mtimeMs === maxAge พอดี (ไม่ > maxAge)
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([filename] as unknown as ReturnType<typeof fs.readdirSync>);
      // mock Date.now ให้ return ค่าคงที่เพื่อให้ควบคุม now ได้แม่นยำ
      const fixedNow = now;
      jest.spyOn(Date, "now").mockReturnValue(fixedNow);
      mockStatSync.mockReturnValue({ mtimeMs: fixedNow - maxAge } as fs.Stats);

      // Act
      service.onApplicationBootstrap();

      // Assert
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it("กรณีมีหลายไฟล์ ทั้งเก่าและใหม่ → ควร delete เฉพาะไฟล์เก่า", () => {
      // Arrange
      const staleFile = "old-photo.jpg";
      const freshFile = "new-photo.jpg";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000; // 25 ชั่วโมงที่แล้ว
      const freshTime = Date.now() - 1 * 60 * 60 * 1000;  // 1 ชั่วโมงที่แล้ว

      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(
        [staleFile, freshFile] as unknown as ReturnType<typeof fs.readdirSync>,
      );
      mockStatSync
        .mockReturnValueOnce({ mtimeMs: staleTime } as fs.Stats)
        .mockReturnValueOnce({ mtimeMs: freshTime } as fs.Stats);

      // Act
      service.onApplicationBootstrap();

      // Assert
      expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
      expect(mockUnlinkSync).toHaveBeenCalledWith(join(tempDir, staleFile));
      expect(mockUnlinkSync).not.toHaveBeenCalledWith(join(tempDir, freshFile));
    });

    it("กรณี readdirSync throw error → ไม่ควร throw exception ออกมา (catch ทุกอย่าง)", () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      // Act & Assert
      expect(() => service.onApplicationBootstrap()).not.toThrow();
    });

    it("ควร set interval สำหรับ cleanup ทุก 1 ชั่วโมง เมื่อ bootstrap", () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      const setIntervalSpy = jest.spyOn(global, "setInterval");

      // Act
      service.onApplicationBootstrap();

      // Assert
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        60 * 60 * 1000,
      );
    });

    it("กรณี interval ทำงาน → ควร cleanup ไฟล์เก่าอีกครั้ง", () => {
      // Arrange
      const staleFile = "interval-stale.jpg";
      const staleTime = Date.now() - 25 * 60 * 60 * 1000;
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([staleFile] as unknown as ReturnType<typeof fs.readdirSync>);
      mockStatSync.mockReturnValue({ mtimeMs: staleTime } as fs.Stats);

      service.onApplicationBootstrap();
      // เคลียร์ mock หลัง bootstrap call แรก
      jest.clearAllMocks();
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([staleFile] as unknown as ReturnType<typeof fs.readdirSync>);
      mockStatSync.mockReturnValue({ mtimeMs: staleTime } as fs.Stats);

      // Act — เลื่อนเวลา 1 ชั่วโมง เพื่อให้ interval ทำงาน
      jest.advanceTimersByTime(60 * 60 * 1000);

      // Assert
      expect(mockUnlinkSync).toHaveBeenCalledWith(join(tempDir, staleFile));
    });
  });
});
