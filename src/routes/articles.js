const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const prisma  = require("../prisma");

// GET /api/articles?course=dijital-kusatma&page=1&limit=20
router.get("/", auth, async (req, res) => {
  const { course, page, limit } = req.query;
  const take  = Math.min(parseInt(limit) || 20, 200);
  const skip  = ((parseInt(page) || 1) - 1) * take;
  const where = course ? { courseSlug: course } : undefined;

  try {
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: { resources: { orderBy: { createdAt: "asc" } } },
        orderBy: { order: "asc" },
        skip,
        take,
      }),
      prisma.article.count({ where }),
    ]);
    res.json({
      articles,
      total,
      page:       parseInt(page) || 1,
      totalPages: Math.ceil(total / take) || 1,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Yazılar alınamadı." });
  }
});

module.exports = router;
