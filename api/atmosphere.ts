import { del, get, put } from "@vercel/blob";
import { bodyOf, isAdmin, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, readJson, sendJson, text, writeJson } from "./_archive.js";

type Atmosphere = { image?: { pathname: string; contentType: string }; audio?: { pathname: string; contentType: string } };

function base64Data(value: string) {
  const match = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  return { contentType: match[1], bytes: Buffer.from(match[2], "base64") };
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method === "GET") {
    res.setHeader("cache-control", "public, max-age=0, s-maxage=300, stale-while-revalidate=900");
    const settings = await readJson<Atmosphere>("settings/atmosphere.json", { useCache: true });
    return sendJson(res, 200, { image: settings?.image ? "/api/media-submission?kind=image" : null, audio: settings?.audio ? "/api/media-submission?kind=audio" : null });
  }
  if (req.method !== "POST" || !isAdmin(req)) return sendJson(res, 401, { error: "这里需要你的审核钥匙。" });
  const input = bodyOf(req);
  const kind = input.kind === "audio" ? "audio" : "image";
  if (input.remove === true) {
    const previous = await readJson<Atmosphere>("settings/atmosphere.json") ?? {};
    if (previous[kind]) await del(previous[kind].pathname);
    delete previous[kind];
    await writeJson("settings/atmosphere.json", previous);
    return sendJson(res, 200, { ok: true });
  }
  const parsed = base64Data(text(input.dataUrl, kind === "audio" ? 2_800_000 : 2_100_000));
  if (!parsed) return sendJson(res, 400, { error: "没有接收到可用的媒体文件。" });
  const allowed = kind === "image" ? /^image\/(jpeg|png|webp)$/ : /^audio\/(mpeg|wav|ogg|mp4)$/;
  const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (!allowed.test(parsed.contentType) || parsed.bytes.length > limit) return sendJson(res, 400, { error: kind === "image" ? "图片限 JPG、PNG、WebP，且不超过 1.5 MB。" : "音频限 MP3、WAV、OGG、M4A，且不超过 2 MB。" });
  const extension = parsed.contentType.split("/")[1] === "mpeg" ? "mp3" : parsed.contentType.split("/")[1];
  const pathname = `atmosphere/${kind}.${extension}`;
  await put(pathname, parsed.bytes, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: parsed.contentType, cacheControlMaxAge: 60 });
  const previous = await readJson<Atmosphere>("settings/atmosphere.json") ?? {};
  await writeJson("settings/atmosphere.json", { ...previous, [kind]: { pathname, contentType: parsed.contentType } });
  return sendJson(res, 200, { ok: true });
}
