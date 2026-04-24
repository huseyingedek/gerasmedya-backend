const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

const VIDEOS_DIR = path.join(__dirname, "../../uploads/videos");

// Video metadata — yeni video eklemek için buraya ekle
const VIDEO_META = [
  {
    slug: "dijital-kusatma-nedir",
    filename: "dijital-kusatma-nedir.mp4",
    title: "Dijital Kuşatma Nedir? Tam Anlatım",
    duration: "14:32",
    desc: "Dijital Kuşatma stratejisinin ne olduğunu, rakiplerinizden nasıl farklılaştığını ve neden çalıştığını baştan sona öğrenin.",
    level: "Başlangıç",
    strategy: "dijital-kusatma",
    order: 1,
  },
  {
    slug: "meta-google-senkron",
    filename: "meta-google-senkron.mp4",
    title: "Meta Ads + Google Ads Birlikte Nasıl Çalışır?",
    duration: "18:45",
    desc: "İki büyük reklam platformunu senkronize şekilde kullanarak müşterinin her adımında görünür olmayı öğrenin.",
    level: "Orta",
    strategy: "dijital-kusatma",
    order: 2,
  },
  {
    slug: "retargeting-kurulum",
    filename: "retargeting-kurulum.mp4",
    title: "Retargeting Kurulumu — Adım Adım",
    duration: "22:10",
    desc: "Meta Pixel ve Google Tag kurulumu, özel kitleler oluşturma ve retargeting kampanyası açma. Ekran paylaşımlı anlatım.",
    level: "İleri",
    strategy: "dijital-kusatma",
    order: 3,
  },
];

// GET /api/videos?strategy=dijital-kusatma
function listVideos(req, res) {
  const { strategy } = req.query;
  const list = strategy
    ? VIDEO_META.filter((v) => v.strategy === strategy)
    : VIDEO_META;

  // Dosyanın gerçekten var olup olmadığını kontrol et
  const result = list.map((v) => {
    const filePath = path.join(VIDEOS_DIR, v.filename);
    return {
      slug: v.slug,
      title: v.title,
      duration: v.duration,
      desc: v.desc,
      level: v.level,
      order: v.order,
      available: fs.existsSync(filePath),
    };
  });

  res.json({ videos: result });
}

// GET /api/videos/:slug/stream?token=JWT
function streamVideo(req, res) {
  try {
    // Token kontrolü (query param üzerinden — <video src> custom header gönderemez)
    const { token } = req.query;
    if (!token) return res.status(401).json({ message: "Token gerekli." });

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Geçersiz veya süresi dolmuş token." });
    }

    const meta = VIDEO_META.find((v) => v.slug === req.params.slug);
    if (!meta) return res.status(404).json({ message: "Video bulunamadı." });

    const videoPath = path.join(VIDEOS_DIR, meta.filename);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ message: "Video henüz yüklenmedi." });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Range request — video seeking için gerekli
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
      });
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (err) {
    console.error("Stream error:", err);
    res.status(500).json({ message: "Video yüklenemedi." });
  }
}

module.exports = { listVideos, streamVideo };
