const prisma = require("../prisma");

// GET /api/courses — sadece DB'den oku
async function listCourses(req, res) {
  let dbCourses = [];
  try {
    dbCourses = await prisma.course.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
  } catch {}

  const source = dbCourses;

  // Video sayılarını al
  let videoCounts = {};
  try {
    const counts = await prisma.video.groupBy({ by: ["courseSlug"], _count: { id: true } });
    counts.forEach((c) => { videoCounts[c.courseSlug] = c._count.id; });
  } catch {}

  const courses = source.map((c) => ({
    id:            c.id,
    slug:          c.slug,
    title:         c.title,
    desc:          c.desc,
    icon:          c.icon,
    category:      c.category,
    categoryLabel: c.categoryLabel,
    gradient:      c.gradient,
    accentColor:   c.accentColor,
    order:         c.order,
    videoCount:    videoCounts[c.slug] || 0,
    active:        (videoCounts[c.slug] || 0) > 0,
    href:          `/panel/egitim/${c.slug}`,
  }));

  res.json({ courses });
}

module.exports = { listCourses };
