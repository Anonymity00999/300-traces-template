import { get } from "@vercel/blob";
import { readJson } from "./_archive.js";

type ApprovedMedia = { id: string; recordKind: "media"; kind: "image" | "audio"; media: { pathname: string; contentType: string }; status: "approved" };
type Atmosphere = { image?: { pathname: string; contentType: string }; audio?: { pathname: string; contentType: string } };

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed");
  const id = typeof req.query?.id === "string" && /^[a-f0-9-]{20,80}$/i.test(req.query.id) ? req.query.id : "";
  let pathname = "";
  let contentType = "";
  if (id) {
    const item = await readJson<ApprovedMedia>(`submissions/approved/${id}.json`, { useCache: true });
    if (!item || item.recordKind !== "media" || item.status !== "approved" || !item.media?.pathname) return res.status(404).send("Not found");
    pathname = item.media.pathname;
    contentType = item.media.contentType;
  } else {
    const kind = req.query?.kind === "audio" ? "audio" : req.query?.kind === "image" ? "image" : "";
    if (!kind) return res.status(404).send("Not found");
    const settings = await readJson<Atmosphere>("settings/atmosphere.json", { useCache: true });
    const item = settings?.[kind];
    if (!item?.pathname || !item.contentType) return res.status(404).send("Not found");
    pathname = item.pathname;
    contentType = item.contentType;
  }
  const file = await get(pathname, { access: "private", useCache: true });
  if (!file || file.statusCode !== 200 || !file.stream) return res.status(404).send("Not found");
  res.status(200).setHeader("content-type", contentType).setHeader("cache-control", "public, max-age=300, s-maxage=600").setHeader("content-disposition", "inline");
  res.send(Buffer.from(await new Response(file.stream).arrayBuffer()));
}
