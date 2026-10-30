import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { cloudinary } from '../config/cloudinary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');

const ALLOWED_IMAGE = /^image\/(jpeg|png|gif|webp)$/;
const ALLOWED_VIDEO = /^video\/(mp4|webm|quicktime)$/;
const EXTENSION_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

let cachedDir = null;

export function getUploadDir() {
  if (cachedDir) return cachedDir;
  const configured = process.env.UPLOAD_DIR;
  const dir = configured
    ? path.resolve(projectRoot, configured)
    : path.join(projectRoot, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  cachedDir = dir;
  return dir;
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_IMAGE.test(file.mimetype) || ALLOWED_VIDEO.test(file.mimetype)) {
      return cb(null, true);
    }
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
    err.message = `Unsupported file type "${file.mimetype}". Allowed: JPEG, PNG, GIF, WebP, MP4, WebM, MOV.`;
    return cb(err);
  },
});

export async function storeBufferToCloudinary(buffer, folder, resourceType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `citizen-care/${folder}`, resource_type: resourceType },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

/**
 * Writes a buffer under the uploads directory and returns its public path.
 * The extension is derived from the MIME type rather than the client-supplied
 * filename, so a caller cannot choose the stored name or escape the directory.
 */
export async function saveLocalFile(buffer, originalname, mimetype) {
  const dir = getUploadDir();
  const ext =
    EXTENSION_BY_MIME[mimetype] ||
    (path.extname(originalname || '').match(/^\.[a-z0-9]{1,5}$/i)
      ? path.extname(originalname).toLowerCase()
      : '.bin');
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  await fs.promises.writeFile(path.join(dir, name), buffer);
  return `/uploads/${name}`;
}
