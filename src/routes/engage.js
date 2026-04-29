const express = require("express");
const router  = express.Router();
const prisma  = require("../prisma");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);

// ── KÜFÜR FİLTRESİ ───────────────────────────────────────────────────
const BANNED_WORDS = [
  "amk", "orospu", "oç", "piç", "göt", "sik", "siktir", "yarrak",
  "amına", "bok", "orospu çocuğu", "pezevenk", "salak", "aptal",
  "gerizekalı", "mal", "kahpe", "anan", "bacın", "ibne", "götveren",
  "oğlancı", "puşt", "şerefsiz", "alçak", "it", "köpek", "eşek",
  "haysiyetsiz", "namussuz", "sürtük", "fahişe",
];

function containsBannedWord(text) {
  const lower = text.toLowerCase().replace(/[^a-zğüşıöç0-9 ]/gi, "");
  return BANNED_WORDS.some((word) => lower.includes(word.toLowerCase()));
}

// ── RATE LİMİTER (in-memory, production için Redis önerilir) ─────────
const commentLog = new Map(); // userId -> [timestamps]
const RATE_LIMIT  = 5;        // max yorum sayısı
const RATE_WINDOW = 60 * 60 * 1000; // 1 saat (ms)

function isRateLimited(userId) {
  const now  = Date.now();
  const log  = (commentLog.get(userId) || []).filter((t) => now - t < RATE_WINDOW);
  commentLog.set(userId, log);
  if (log.length >= RATE_LIMIT) return true;
  log.push(now);
  return false;
}

// ── NOTLAR ────────────────────────────────────────────────────────────

// GET /api/engage/:slug/note
router.get("/:slug/note", async (req, res) => {
  const note = await prisma.videoNote.findUnique({
    where: { userId_videoSlug: { userId: req.user.id, videoSlug: req.params.slug } },
  });
  res.json({ content: note?.content || "" });
});

// POST /api/engage/:slug/note
router.post("/:slug/note", async (req, res) => {
  const { content } = req.body;
  const note = await prisma.videoNote.upsert({
    where:  { userId_videoSlug: { userId: req.user.id, videoSlug: req.params.slug } },
    update: { content },
    create: { userId: req.user.id, videoSlug: req.params.slug, content },
  });
  res.json(note);
});

// ── PUANLAMA ──────────────────────────────────────────────────────────

// GET /api/engage/:slug/rating
router.get("/:slug/rating", async (req, res) => {
  const [myRating, agg] = await Promise.all([
    prisma.videoRating.findUnique({
      where: { userId_videoSlug: { userId: req.user.id, videoSlug: req.params.slug } },
    }),
    prisma.videoRating.aggregate({
      where:   { videoSlug: req.params.slug },
      _avg:    { rating: true },
      _count:  { rating: true },
    }),
  ]);
  res.json({
    myRating: myRating?.rating || 0,
    avg:      Math.round((agg._avg.rating || 0) * 10) / 10,
    count:    agg._count.rating,
  });
});

// POST /api/engage/:slug/rating
router.post("/:slug/rating", async (req, res) => {
  const rating = Math.max(1, Math.min(5, parseInt(req.body.rating)));
  await prisma.videoRating.upsert({
    where:  { userId_videoSlug: { userId: req.user.id, videoSlug: req.params.slug } },
    update: { rating },
    create: { userId: req.user.id, videoSlug: req.params.slug, rating },
  });
  const agg = await prisma.videoRating.aggregate({
    where: { videoSlug: req.params.slug },
    _avg:  { rating: true },
    _count:{ rating: true },
  });
  res.json({
    myRating: rating,
    avg:      Math.round((agg._avg.rating || 0) * 10) / 10,
    count:    agg._count.rating,
  });
});

// ── YORUMLAR ──────────────────────────────────────────────────────────

// GET /api/engage/:slug/comments
router.get("/:slug/comments", async (req, res) => {
  const comments = await prisma.videoComment.findMany({
    where:   { videoSlug: req.params.slug },
    orderBy: { createdAt: "desc" },
  });
  res.json({ comments });
});

// POST /api/engage/:slug/comments
router.post("/:slug/comments", async (req, res) => {
  const { content } = req.body;

  // Boşluk kontrolü
  if (!content?.trim()) {
    return res.status(400).json({ error: "Yorum boş olamaz." });
  }

  // Minimum uzunluk
  if (content.trim().length < 5) {
    return res.status(400).json({ error: "Yorum en az 5 karakter olmalıdır." });
  }

  // Maksimum uzunluk
  if (content.trim().length > 1000) {
    return res.status(400).json({ error: "Yorum en fazla 1000 karakter olabilir." });
  }

  // Küfür filtresi (admin muaf)
  if (req.user.role !== "admin" && containsBannedWord(content)) {
    return res.status(400).json({ error: "Yorumunuz uygunsuz ifadeler içeriyor." });
  }

  // Rate limit (admin muaf)
  if (req.user.role !== "admin" && isRateLimited(req.user.id)) {
    return res.status(429).json({ error: "Çok fazla yorum gönderdiniz. 1 saat içinde en fazla 5 yorum yapabilirsiniz." });
  }

  const comment = await prisma.videoComment.create({
    data: {
      userId:    req.user.id,
      userName:  req.user.name,
      videoSlug: req.params.slug,
      content:   content.trim(),
    },
  });
  res.json(comment);
});

// DELETE /api/engage/:slug/comments/:id
router.delete("/:slug/comments/:id", async (req, res) => {
  const comment = await prisma.videoComment.findUnique({ where: { id: req.params.id } });
  if (!comment) return res.status(404).json({ error: "Yorum bulunamadı." });
  if (comment.userId !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "Yetkisiz." });
  await prisma.videoComment.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
