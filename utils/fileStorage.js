/**
 * Disk-backed storage for uploaded company files (logo, license, certificate).
 * Replaces the old base64-in-DB approach — only a short `/uploads/...` path
 * is stored on the model; the actual bytes live on disk.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const fileType = require("file-type");

const UPLOADS_ROOT = path.join(__dirname, "../uploads");

const EXT_BY_MIME_TYPE = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

/**
 * Map a MIME type to a file extension (including the leading dot).
 * Falls back to no extension for unrecognized types.
 */
const mimeToExt = (mimetype) => EXT_BY_MIME_TYPE[mimetype] || "";

/**
 * Write an uploaded file buffer to disk under uploads/<subdir>/ and return
 * the public path (e.g. "/uploads/companies/<uuid>.pdf") to store on the model.
 */
const saveBufferToDisk = (buffer, mimetype, subdir = "companies") => {
  const dir = path.join(UPLOADS_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}${mimeToExt(mimetype)}`;
  fs.writeFileSync(path.join(dir, filename), buffer);

  return `/uploads/${subdir}/${filename}`;
};

/**
 * Verifies a file's actual bytes match its declared mimetype, by sniffing
 * the magic bytes. Multer's fileFilter only checks the client-supplied
 * Content-Type header, which a caller can freely spoof, so this closes that
 * gap for anything that gets written to disk and served back publicly.
 * Throws a 400-flagged Error when the content doesn't match.
 */
const verifyFileType = async (buffer, declaredMimetype) => {
  const detected = await fileType.fromBuffer(buffer);

  if (!detected || !EXT_BY_MIME_TYPE[detected.mime] || detected.mime !== declaredMimetype) {
    const error = new Error(
      `Uploaded file content does not match its declared type (${declaredMimetype}).`,
    );
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Verifies the file's real content matches its declared mimetype, then
 * writes it to disk. Use this (not saveBufferToDisk directly) for any file
 * buffer arriving from an untrusted upload.
 */
const saveUploadedFile = async (buffer, mimetype, subdir = "companies") => {
  await verifyFileType(buffer, mimetype);
  return saveBufferToDisk(buffer, mimetype, subdir);
};

/**
 * Best-effort delete of a file previously written by saveBufferToDisk.
 * Only acts on strings that look like a managed `/uploads/...` path, and
 * never throws — this is cleanup on replace, not a critical operation.
 */
const deleteFileIfManaged = (relativePath) => {
  if (!relativePath || !relativePath.startsWith("/uploads/")) return;

  const absolutePath = path.join(UPLOADS_ROOT, relativePath.replace(/^\/uploads\//, ""));
  fs.unlink(absolutePath, () => {});
};

/**
 * Resolve any of the historical value shapes for these fields into a
 * `data:` base64 URI, for consumers (PDF generation) that still need base64.
 *   - null/empty            -> null
 *   - already a data: URI   -> returned as-is (legacy row not yet backfilled)
 *   - /uploads/... path     -> read from disk and re-encode
 *   - bare legacy filename  -> resolve under uploads/logos/ and encode
 */
const readAsBase64DataUri = (value) => {
  if (!value) return null;
  if (value.startsWith("data:")) return value;

  let absolutePath;
  if (value.startsWith("/uploads/")) {
    absolutePath = path.join(UPLOADS_ROOT, value.replace(/^\/uploads\//, ""));
  } else if (value.startsWith("uploads/")) {
    absolutePath = path.join(UPLOADS_ROOT, value.replace(/^uploads\//, ""));
  } else {
    absolutePath = path.join(UPLOADS_ROOT, "logos", value);
  }

  if (!fs.existsSync(absolutePath)) return null;

  const ext = path.extname(absolutePath).toLowerCase();
  const mimetype =
    Object.entries(EXT_BY_MIME_TYPE).find(([, e]) => e === ext)?.[0] ||
    "application/octet-stream";

  return `data:${mimetype};base64,${fs.readFileSync(absolutePath).toString("base64")}`;
};

module.exports = {
  mimeToExt,
  saveBufferToDisk,
  saveUploadedFile,
  deleteFileIfManaged,
  readAsBase64DataUri,
};
