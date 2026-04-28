const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const prisma  = require("../prisma");

// GET /api/articles?course=dijital-kusatma
router.get("/", auth, async (req, res) => {
  const { course } = req.query;
  try {
    const articles = await prisma.article.findMany({
      where: course ? { courseSlug: course } : undefined,
      include: { resources: { orderBy: { createdAt: "asc" } } },
      orderBy: { order: "asc" },
    });
    res.json({ articles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Yazılar alınamadı." });
  }
});

module.exports = router;
