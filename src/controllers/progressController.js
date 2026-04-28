const prisma = require("../prisma");

const AUTO_COMPLETE_PERCENT = 85; // %85 izlenince otomatik tamamlandı

// GET /api/progress?strategy=dijital-kusatma
async function getProgress(req, res) {
  try {
    const { strategy } = req.query;
    const where = { userId: req.user.id };
    if (strategy) where.strategy = strategy;

    const progress = await prisma.progress.findMany({ where });
    res.json({
      progress: progress.map((p) => ({
        slug:         p.contentSlug,
        type:         p.contentType,
        completed:    p.completed,
        completedAt:  p.completedAt,
        position:     p.position,
        duration:     p.duration,
        watchPercent: p.watchPercent,
      })),
    });
  } catch (err) {
    console.error("getProgress error:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
}

// POST /api/progress/toggle  — yazı / manuel tamamlama
async function toggleProgress(req, res) {
  try {
    const { contentSlug, contentType, strategy } = req.body;
    if (!contentSlug || !contentType || !strategy)
      return res.status(400).json({ message: "Eksik bilgi." });

    const existing = await prisma.progress.findUnique({
      where: { userId_contentSlug: { userId: req.user.id, contentSlug } },
    });

    if (existing) {
      const newCompleted = !existing.completed;
      const updated = await prisma.progress.update({
        where: { id: existing.id },
        data: {
          completed:   newCompleted,
          completedAt: newCompleted ? new Date() : null,
        },
      });
      res.json({ completed: updated.completed, contentSlug });
    } else {
      await prisma.progress.create({
        data: {
          userId:      req.user.id,
          contentSlug,
          contentType,
          strategy,
          completed:   true,
          completedAt: new Date(),
        },
      });
      res.json({ completed: true, contentSlug });
    }
  } catch (err) {
    console.error("toggleProgress error:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
}

// POST /api/progress/video-position  — her 10 saniyede bir çağrılır
// body: { contentSlug, strategy, position, duration }
async function saveVideoPosition(req, res) {
  try {
    const { contentSlug, strategy, position, duration } = req.body;
    if (!contentSlug || !strategy || position === undefined || !duration)
      return res.status(400).json({ message: "Eksik bilgi." });

    const watchPercent = Math.min(100, Math.round((position / duration) * 100));
    const autoComplete = watchPercent >= AUTO_COMPLETE_PERCENT;

    await prisma.progress.upsert({
      where: { userId_contentSlug: { userId: req.user.id, contentSlug } },
      update: {
        position,
        duration,
        watchPercent,
        ...(autoComplete
          ? { completed: true, completedAt: new Date() }
          : {}),
      },
      create: {
        userId:      req.user.id,
        contentSlug,
        contentType: "video",
        strategy,
        position,
        duration,
        watchPercent,
        completed:   autoComplete,
        completedAt: autoComplete ? new Date() : null,
      },
    });

    res.json({ watchPercent, autoCompleted: autoComplete });
  } catch (err) {
    console.error("saveVideoPosition error:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
}

module.exports = { getProgress, toggleProgress, saveVideoPosition };
