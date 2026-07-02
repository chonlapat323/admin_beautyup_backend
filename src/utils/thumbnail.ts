import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";

const THUMB_WIDTH = 400;
const THUMB_QUALITY = 60;

function thumbFilename(originalFilename: string): string {
  return originalFilename.replace(/\.[^.]+$/, ".jpg");
}

export function thumbDestPath(sourceFilePath: string, type: string): string {
  const filename = sourceFilePath.split(/[/\\]/).pop() ?? "";
  const thumbDir = join(process.cwd(), "uploads", "thumbnails", type);
  if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true });
  return join(thumbDir, thumbFilename(filename));
}

export function thumbUrl(appUrl: string, type: string, originalFilename: string): string {
  return `${appUrl}/uploads/thumbnails/${type}/${thumbFilename(originalFilename)}`;
}

export async function generateThumbFor(
  destFilePath: string,
  type: string,
  appUrl: string,
): Promise<string | null> {
  try {
    if (!existsSync(destFilePath)) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp: (path: string) => any = require("sharp");
    const filename = destFilePath.split(/[/\\]/).pop() ?? "";
    const thumbDir = join(process.cwd(), "uploads", "thumbnails", type);
    if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true });
    const thumbPath = join(thumbDir, thumbFilename(filename));
    await sharp(destFilePath)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY })
      .toFile(thumbPath);
    return thumbUrl(appUrl, type, filename);
  } catch {
    return null;
  }
}

export function deleteThumbnailFor(type: string, originalFilename: string): void {
  try {
    const thumbPath = join(
      process.cwd(),
      "uploads",
      "thumbnails",
      type,
      thumbFilename(originalFilename),
    );
    if (existsSync(thumbPath)) unlinkSync(thumbPath);
  } catch { /* ignore */ }
}
