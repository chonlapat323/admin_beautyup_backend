import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { diskStorage } from "multer";
import { Controller, Delete, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";

import { UploadsService } from "./uploads.service";

const tempDir = join(process.cwd(), "uploads", "temp");

const multerOptions = {
  storage: diskStorage({
    destination: (_req: unknown, _file: unknown, cb: (err: Error | null, dest: string) => void) => {
      if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
      cb(null, tempDir);
    },
    filename: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, name: string) => void) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};

@ApiTags("Uploads")
@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("temp")
  @ApiOperation({ summary: "Upload a file to temp storage" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  uploadTemp(@UploadedFile() file: Express.Multer.File) {
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
    return {
      filename: file.filename,
      url: `${appUrl}/uploads/temp/${file.filename}`,
    };
  }

  @Delete("temp/:filename")
  @ApiOperation({ summary: "Delete a temp file" })
  removeTemp(@Param("filename") filename: string) {
    this.uploadsService.removeTempFile(filename);
    return { message: "Deleted" };
  }
}
