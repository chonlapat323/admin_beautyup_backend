import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { Injectable, OnApplicationBootstrap } from "@nestjs/common";

@Injectable()
export class UploadsService implements OnApplicationBootstrap {
  private readonly tempDir = join(process.cwd(), "uploads", "temp");

  onApplicationBootstrap() {
    this.cleanupStaleTempFiles();
    setInterval(() => this.cleanupStaleTempFiles(), 60 * 60 * 1000);
  }

  private cleanupStaleTempFiles() {
    if (!existsSync(this.tempDir)) return;
    const maxAge = 24 * 60 * 60 * 1000;
    const now = Date.now();
    try {
      for (const filename of readdirSync(this.tempDir)) {
        const filePath = join(this.tempDir, filename);
        if (now - statSync(filePath).mtimeMs > maxAge) {
          unlinkSync(filePath);
        }
      }
    } catch {
      // ignore cleanup errors
    }
  }

  removeTempFile(filename: string): void {
    const filePath = join(this.tempDir, filename);
    if (existsSync(filePath)) unlinkSync(filePath);
  }

  ensureTempDir(): void {
    if (!existsSync(this.tempDir)) mkdirSync(this.tempDir, { recursive: true });
  }
}
