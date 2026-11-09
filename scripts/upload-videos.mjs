/**
 * Compresses every video in raw-videos/, makes its poster, uploads it to Cloudinary as
 * "authenticated" under a random public ID, and records it in src/data/photos.json.
 *
 *   pnpm upload-videos            only videos not uploaded yet
 *   pnpm upload-videos --force    also replace the ones already uploaded
 *
 * The file name is the video's id: raw-videos/guest-y2-nhac-cu.mp4 → "guest-y2-nhac-cu".
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, parse } from "node:path";
import { v2 as cloudinary } from "cloudinary";

const RAW_DIR = "raw-videos";
const CATALOG = "src/data/photos.json";
const MEMORIES = "src/data/memories.json";
const POSTER_DIR = "public/images/videos";
const EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"]);

const VIDEO_KBPS = 1500;
const AUDIO_KBPS = 96;
const SHORT_EDGE = 720;
const POSTER_LONG_EDGE = 1200;
const MB = 1024 * 1024;
/** Cloudinary's Free plan refuses videos of 100 MB and above. */
const MAX_BYTES = 100 * MB;
/** A long video gets a lower bitrate so it lands safely under the limit. */
const TARGET_BYTES = 95 * MB;

function stop(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function run(tool, args) {
  const result = spawnSync(tool, args, { encoding: "utf8", maxBuffer: 16 * MB });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${tool}: ${result.stderr.trim().split("\n").slice(-3).join(" | ")}`);
  return result.stdout;
}

function requireFfmpeg() {
  for (const tool of ["ffmpeg", "ffprobe"]) {
    if (spawnSync(tool, ["-version"]).status !== 0) {
      stop(
        `Chưa thấy ${tool} trên máy. Cài bằng lệnh sau, rồi MỞ LẠI terminal và chạy lại:\n\n` +
          "  winget install --id Gyan.FFmpeg -e\n\n" +
          "macOS: brew install ffmpeg | Ubuntu: sudo apt install ffmpeg",
      );
    }
  }
}

function loadCredentials() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* no file: the variables may already be in the environment */
  }
  const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env;
  if (!cloud_name || !api_key || !api_secret) stop("Thiếu CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY hoặc CLOUDINARY_API_SECRET trong .env.local.");
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
}

function videoId(file) {
  return parse(file)
    .name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function probe(path) {
  const info = JSON.parse(run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,color_transfer:format=duration", "-of", "json", path]));
  const stream = info.streams?.[0];
  if (!stream) throw new Error("không tìm thấy luồng hình trong file");
  return { width: stream.width, height: stream.height, transfer: stream.color_transfer, duration: Number(info.format?.duration) || 0 };
}

/** Phone HDR footage (HLG, PQ) looks washed out once converted to H.264 without tone mapping. */
function toneMap(transfer) {
  return transfer === "arib-std-b67" || transfer === "smpte2084" ? "zscale=t=linear:npl=100,format=gbrpf32le,tonemap=hable:desat=0,zscale=p=bt709:t=bt709:m=bt709:r=tv," : "";
}

function compress(source, output, { duration, transfer }) {
  const budget = duration > 0 ? Math.floor((TARGET_BYTES * 8) / duration / 1000) - AUDIO_KBPS : VIDEO_KBPS;
  const kbps = Math.min(VIDEO_KBPS, budget);
  if (kbps < 200) throw new Error(`video quá dài (${Math.round(duration / 60)} phút) để giữ dưới 100 MB; hãy cắt ngắn bớt`);
  // Short edge 720 for landscape and portrait alike, never upscaling. Dimensions stay even for H.264.
  const scale = `scale=w='if(gt(iw,ih),-2,min(${SHORT_EDGE},iw))':h='if(gt(iw,ih),min(${SHORT_EDGE},ih),-2)'`;
  run("ffmpeg", [
    "-y", "-v", "error", "-i", source,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", `${toneMap(transfer)}${scale},format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-profile:v", "high",
    "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.4)}k`, "-bufsize", `${kbps * 2}k`,
    "-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`, "-ac", "2",
    // Lets the browser read the metadata and start playing before the whole file arrives.
    "-movflags", "+faststart",
    output,
  ]);
  const size = statSync(output).size;
  if (size >= MAX_BYTES) throw new Error(`sau khi nén vẫn ${(size / MB).toFixed(1)} MB, vượt giới hạn 100 MB`);
  return size;
}

function makePoster(source, output, at, { duration, transfer }) {
  const second = duration > 0 ? Math.min(at, Math.max(duration - 0.2, 0)) : 0;
  const scale = `scale=w='if(gt(iw,ih),min(${POSTER_LONG_EDGE},iw),-2)':h='if(gt(iw,ih),-2,min(${POSTER_LONG_EDGE},ih))'`;
  run("ffmpeg", ["-y", "-v", "error", "-ss", String(second), "-i", source, "-frames:v", "1", "-vf", `${toneMap(transfer)}${scale}`, "-c:v", "libwebp", "-quality", "78", output]);
}

function upload(path, publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      path,
      { resource_type: "video", type: "authenticated", public_id: publicId, overwrite: false, chunk_size: 20 * MB },
      (error, result) => (error ? reject(new Error(error.message ?? JSON.stringify(error))) : resolve(result)),
    );
  });
}

/** Written after every video, so a failure further on never loses what was already uploaded. */
function saveCatalog(catalog) {
  const temp = `${CATALOG}.tmp`;
  writeFileSync(temp, `${JSON.stringify(catalog, null, 2)}\n`);
  renameSync(temp, CATALOG);
}

async function main() {
  const force = process.argv.includes("--force");
  requireFfmpeg();
  loadCredentials();

  if (!existsSync(RAW_DIR)) {
    mkdirSync(RAW_DIR);
    stop(`Đã tạo thư mục ${RAW_DIR}/. Chép video vào đó (tên file là id, ví dụ guest-y2-nhac-cu.mp4) rồi chạy lại.`);
  }
  const files = readdirSync(RAW_DIR).filter((f) => EXTENSIONS.has(extname(f).toLowerCase()));
  if (files.length === 0) stop(`Không có video nào trong ${RAW_DIR}/.`);

  const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
  const memories = readFileSync(MEMORIES, "utf8");
  mkdirSync(POSTER_DIR, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "upload-videos-"));

  const uploaded = [];
  const skipped = [];
  const failed = [];

  for (const file of files) {
    const id = videoId(file);
    const existing = catalog.find((v) => v.id === id);
    if (existing?.cloudinaryPublicId && !force) {
      skipped.push(file);
      console.log(`- ${file}: đã upload từ trước, bỏ qua (dùng --force để thay)`);
      continue;
    }
    try {
      const source = join(RAW_DIR, file);
      const info = probe(source);
      console.log(`- ${file}: đang nén (${Math.round(info.duration)} giây)...`);
      const output = join(work, `${id}.mp4`);
      const size = compress(source, output, info);
      const { width, height } = probe(output);

      const poster = join(POSTER_DIR, `${id}.webp`);
      makePoster(source, poster, existing?.posterAt ?? 1, info);

      console.log(`  đang upload ${(size / MB).toFixed(1)} MB...`);
      const publicId = randomBytes(16).toString("hex");
      await upload(output, publicId);

      const item = { id, type: "video", caption: id, ...existing, cloudinaryPublicId: publicId, poster: `/images/videos/${id}.webp`, width, height };
      if (existing) catalog[catalog.indexOf(existing)] = item;
      else catalog.push(item);
      saveCatalog(catalog);

      // Only once the catalog points at the new upload is the replaced one safe to delete.
      if (existing?.cloudinaryPublicId) {
        await cloudinary.uploader
          .destroy(existing.cloudinaryPublicId, { resource_type: "video", type: "authenticated", invalidate: true })
          .catch((e) => console.warn(`  không xóa được bản cũ ${existing.cloudinaryPublicId}: ${e.message}`));
      }
      uploaded.push({ file, id, size, width, height, isNew: !existing, linked: memories.includes(`"${id}"`) });
      console.log(`  xong: ${width}x${height}`);
    } catch (e) {
      failed.push({ file, reason: e.message });
      console.error(`  LỖI: ${e.message}`);
    }
  }
  rmSync(work, { recursive: true, force: true });

  console.log("\n===== KẾT QUẢ =====");
  console.log(`Đã upload: ${uploaded.length}`);
  for (const u of uploaded) console.log(`  ✓ ${u.file} → ${u.id} (${u.width}x${u.height}, ${(u.size / MB).toFixed(1)} MB: mỗi lượt xem hết tốn ngần này băng thông)`);
  console.log(`Bỏ qua: ${skipped.length}`);
  for (const f of skipped) console.log(`  - ${f}`);
  console.log(`Lỗi: ${failed.length}`);
  for (const f of failed) console.log(`  ✗ ${f.file}: ${f.reason}`);

  const newOnes = uploaded.filter((u) => u.isNew);
  if (newOnes.length) console.log(`\nSửa caption trong ${CATALOG}: ${newOnes.map((u) => u.id).join(", ")}`);
  const unlinked = uploaded.filter((u) => !u.linked);
  if (unlinked.length) console.log(`\nChưa gắn vào album nào, thêm { "video": "<id>" } vào ${MEMORIES}: ${unlinked.map((u) => u.id).join(", ")}`);
  if (uploaded.length) console.log(`\nNhớ commit ${CATALOG} và ${POSTER_DIR}/ rồi deploy lại.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => stop(e.message));
