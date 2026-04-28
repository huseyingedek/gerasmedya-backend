const jwt    = require("jsonwebtoken");
const { GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const r2     = require("../lib/r2");
const prisma = require("../prisma");

const BUCKET = process.env.R2_BUCKET_NAME || "geras-videos";

// Hardcoded fallback — admin panelinden DB'ye eklenmeden önce çalışır
const FALLBACK_VIDEOS = [
  {
    slug:        "dijital-kusatma-nedir",
    filename:    "dijital-kusatma-nedir.mp4",
    title:       "Dijital Kuşatma Nedir? Tam Anlatım",
    duration:    "14:32",
    description: "Dijital Kuşatma stratejisinin ne olduğunu, rakiplerinizden nasıl farklılaştığını ve neden çalıştığını baştan sona öğrenin.",
    level:       "Başlangıç",
    courseSlug:  "dijital-kusatma",
    order:       1,
  },
  {
    slug:        "meta-google-senkron",
    filename:    "meta-google-senkron.mp4",
    title:       "Meta Ads + Google Ads Birlikte Nasıl Çalışır?",
    duration:    "18:45",
    description: "İki büyük reklam platformunu senkronize şekilde kullanarak müşterinin her adımında görünür olmayı öğrenin.",
    level:       "Orta",
    courseSlug:  "dijital-kusatma",
    order:       2,
  },
  {
    slug:        "retargeting-kurulum",
    filename:    "retargeting-kurulum.mp4",
    title:       "Retargeting Kurulumu — Adım Adım",
    duration:    "22:10",
    description: "Meta Pixel ve Google Tag kurulumu, özel kitleler oluşturma ve retargeting kampanyası açma.",
    level:       "İleri",
    courseSlug:  "dijital-kusatma",
    order:       3,
  },
];

// GET /api/videos?strategy=dijital-kusatma
async function listVideos(req, res) {
  const { strategy } = req.query;

  let list = [];
  try {
    list = await prisma.video.findMany({
      where: strategy ? { courseSlug: strategy } : undefined,
      include: { resources: { orderBy: { createdAt: "asc" } } },
      orderBy: { order: "asc" },
    });
  } catch {}

  // DB boşsa hardcoded fallback kullan
  if (list.length === 0) {
    list = strategy
      ? FALLBACK_VIDEOS.filter((v) => v.courseSlug === strategy)
      : FALLBACK_VIDEOS;
  }

  const results = await Promise.all(
    list.map(async (v) => {
      let available = false;
      try {
        await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: v.filename }));
        available = true;
      } catch {}
      return {
        id:        v.id    || null,
        slug:      v.slug,
        title:     v.title,
        duration:  v.duration,
        desc:      v.description || "",
        level:     v.level,
        order:     v.order,
        resources: v.resources || [],
        available,
      };
    })
  );

  res.json({ videos: results });
}

// GET /api/videos/:slug/stream?token=JWT
async function streamVideo(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(401).json({ message: "Token gerekli." });
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Geçersiz token." });
    }

    // DB'de ara, yoksa fallback
    let meta = null;
    try {
      meta = await prisma.video.findUnique({ where: { slug: req.params.slug } });
    } catch {}
    if (!meta) meta = FALLBACK_VIDEOS.find((v) => v.slug === req.params.slug);
    if (!meta) return res.status(404).json({ message: "Video bulunamadı." });

    let fileSize;
    try {
      const head = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: meta.filename }));
      fileSize = head.ContentLength;
    } catch {
      return res.status(404).json({ message: "Video henüz yüklenmedi." });
    }

    const range = req.headers.range;
    if (range) {
      const parts     = range.replace(/bytes=/, "").split("-");
      const start     = parseInt(parts[0], 10);
      const end       = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const { Body } = await r2.send(new GetObjectCommand({
        Bucket: BUCKET, Key: meta.filename, Range: `bytes=${start}-${end}`,
      }));

      res.writeHead(206, {
        "Content-Range":  `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges":  "bytes",
        "Content-Length": chunksize,
        "Content-Type":   "video/mp4",
        "Cache-Control":  "no-store",
      });
      Body.pipe(res);
    } else {
      const { Body } = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: meta.filename }));
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type":   "video/mp4",
        "Accept-Ranges":  "bytes",
        "Cache-Control":  "no-store",
      });
      Body.pipe(res);
    }
  } catch (err) {
    console.error("Stream error:", err);
    res.status(500).json({ message: "Video yüklenemedi." });
  }
}

module.exports = { listVideos, streamVideo };
