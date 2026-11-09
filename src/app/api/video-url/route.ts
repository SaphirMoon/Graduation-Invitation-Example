import { v2 as cloudinary } from "cloudinary";
import { getGuest } from "@/lib/guests";
import { albumHasVideo, videoPublicId } from "@/lib/memories";

const RATE_LIMIT = { requests: 30, windowMs: 60_000, maxTrackedClients: 5000 };

/**
 * Per-client counters. They live in this server instance's memory, so on Vercel the limit is
 * per instance: enough to stop a careless loop, not a distributed attack.
 */
const clients = new Map<string, { count: number; resetAt: number }>();

/** Seconds to wait when the client is over the limit, otherwise 0. */
function retryAfter(ip: string, now: number) {
  if (clients.size >= RATE_LIMIT.maxTrackedClients) clients.clear();
  const client = clients.get(ip);
  if (!client || client.resetAt <= now) {
    clients.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return 0;
  }
  client.count += 1;
  return client.count > RATE_LIMIT.requests ? Math.ceil((client.resetAt - now) / 1000) : 0;
}

function fail(status: number, error: string, headers?: HeadersInit) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * GET /api/video-url?slug=<guest>&id=<video>: a signed URL for a video in that guest's album.
 * The slug resolves exactly as the page does: `/` and unknown links get the entry with an empty
 * key in guests.json, so the videos in that album are open to anyone, while another guest's
 * album needs that guest's slug.
 */
export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
  const wait = retryAfter(ip, Date.now());
  if (wait > 0) return fail(429, "too_many_requests", { "Retry-After": String(wait) });

  const params = new URL(request.url).searchParams;
  const slug = params.get("slug") ?? "";
  const id = params.get("id") ?? "";
  if (slug.length > 80 || !/^[\w-]{1,64}$/.test(id)) return fail(400, "bad_request");

  let album: string | undefined;
  try {
    album = getGuest(slug).guest.album;
  } catch {
    return fail(400, "bad_request");
  }

  const publicId = videoPublicId(id);
  // Same answer for "no such video" and "not in this album": the response doesn't reveal which ids exist.
  if (!publicId || !albumHasVideo(album, id)) return fail(404, "not_found");

  const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env;
  if (!cloud_name || !api_key || !api_secret) return fail(503, "not_configured");

  const url = cloudinary.url(publicId, {
    cloud_name,
    api_key,
    api_secret,
    resource_type: "video",
    type: "authenticated",
    format: "mp4",
    sign_url: true,
    secure: true,
  });
  // A signed URL never expires by itself; this only saves repeat calls when a video is reopened.
  return Response.json({ url }, { headers: { "Cache-Control": "private, max-age=600" } });
}
