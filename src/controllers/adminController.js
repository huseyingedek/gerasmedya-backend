const prisma   = require("../prisma");
const r2        = require("../lib/r2");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const BUCKET = process.env.R2_BUCKET_NAME || "geras-videos";

// ═══════════════════════════════════════════
// VİDEO YÖNETİMİ
// ═══════════════════════════════════════════

// GET /api/admin/videos?course=dijital-kusatma
async function listVideos(req, res) {
  const { course } = req.query;
  const videos = await prisma.video.findMany({
    where: course ? { courseSlug: course } : undefined,
    include: { resources: true },
    orderBy: [{ courseSlug: "asc" }, { order: "asc" }],
  });
  res.json({ videos });
}

// POST /api/admin/videos
async function createVideo(req, res) {
  const { slug, filename, title, description, duration, level, courseSlug, order } = req.body;
  if (!slug || !filename || !title || !courseSlug)
    return res.status(400).json({ message: "slug, filename, title, courseSlug zorunlu." });

  try {
    const video = await prisma.video.create({
      data: { slug, filename, title, description, duration, level, courseSlug, order: order || 0 },
    });
    res.json({ video });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "Bu slug zaten kullanılıyor." });
    throw err;
  }
}

// PUT /api/admin/videos/:id
async function updateVideo(req, res) {
  const id = parseInt(req.params.id);
  const { slug, filename, title, description, duration, level, courseSlug, order } = req.body;
  try {
    const video = await prisma.video.update({
      where: { id },
      data: { slug, filename, title, description, duration, level, courseSlug, order },
    });
    res.json({ video });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ message: "Video bulunamadı." });
    throw err;
  }
}

// DELETE /api/admin/videos/:id
async function deleteVideo(req, res) {
  const id = parseInt(req.params.id);
  await prisma.video.delete({ where: { id } });
  res.json({ ok: true });
}

// GET /api/admin/upload-url?filename=xyz.mp4
// Presigned PUT URL — tarayıcı doğrudan R2'ye yükler
async function getUploadUrl(req, res) {
  const { filename, contentType } = req.query;
  if (!filename) return res.status(400).json({ message: "filename zorunlu." });

  // Dosya uzantısına göre content type belirle
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeMap = { mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska", webm: "video/webm" };
  const mime = contentType || mimeMap[ext] || "video/mp4";

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key:    filename,
    ContentType: mime,
  });

  try {
    const url = await getSignedUrl(r2, command, { expiresIn: 3600 }); // 1 saat geçerli
    res.json({ url, filename });
  } catch (err) {
    console.error("Presigned URL hatası:", err);
    res.status(500).json({ message: "Upload URL alınamadı." });
  }
}

// ═══════════════════════════════════════════
// YAZI YÖNETİMİ
// ═══════════════════════════════════════════

// GET /api/admin/articles?course=dijital-kusatma
async function listArticles(req, res) {
  const { course } = req.query;
  const articles = await prisma.article.findMany({
    where: course ? { courseSlug: course } : undefined,
    include: { resources: true },
    orderBy: [{ courseSlug: "asc" }, { order: "asc" }],
  });
  res.json({ articles });
}

// POST /api/admin/articles
async function createArticle(req, res) {
  const { courseSlug, title, duration, isTemplate, content, order } = req.body;
  if (!courseSlug || !title || !content)
    return res.status(400).json({ message: "courseSlug, title, content zorunlu." });

  const article = await prisma.article.create({
    data: {
      courseSlug,
      title,
      duration:   duration   || null,
      isTemplate: isTemplate || false,
      content:    content,   // JSON paragraphs array
      order:      order      || 0,
    },
  });
  res.json({ article });
}

// PUT /api/admin/articles/:id
async function updateArticle(req, res) {
  const id = parseInt(req.params.id);
  const { title, duration, isTemplate, content, order, courseSlug } = req.body;
  try {
    const article = await prisma.article.update({
      where: { id },
      data: { title, duration, isTemplate, content, order, courseSlug },
    });
    res.json({ article });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ message: "Yazı bulunamadı." });
    throw err;
  }
}

// DELETE /api/admin/articles/:id
async function deleteArticle(req, res) {
  const id = parseInt(req.params.id);
  await prisma.article.delete({ where: { id } });
  res.json({ ok: true });
}

// ═══════════════════════════════════════════
// KAYNAK (İNDİRME LİNKİ) YÖNETİMİ
// ═══════════════════════════════════════════

// GET /api/admin/resources?videoId=1  veya  ?articleId=2
async function listResources(req, res) {
  const { videoId, articleId } = req.query;
  const where = {};
  if (videoId)   where.videoId   = parseInt(videoId);
  if (articleId) where.articleId = parseInt(articleId);

  const resources = await prisma.resource.findMany({ where, orderBy: { createdAt: "asc" } });
  res.json({ resources });
}

// POST /api/admin/resources
async function createResource(req, res) {
  const { title, url, type, videoId, articleId } = req.body;
  if (!title || !url) return res.status(400).json({ message: "title ve url zorunlu." });

  const resource = await prisma.resource.create({
    data: {
      title,
      url,
      type:      type      || "link",
      videoId:   videoId   ? parseInt(videoId)   : null,
      articleId: articleId ? parseInt(articleId) : null,
    },
  });
  res.json({ resource });
}

// PUT /api/admin/resources/:id
async function updateResource(req, res) {
  const id = parseInt(req.params.id);
  const { title, url, type } = req.body;
  const resource = await prisma.resource.update({ where: { id }, data: { title, url, type } });
  res.json({ resource });
}

// DELETE /api/admin/resources/:id
async function deleteResource(req, res) {
  const id = parseInt(req.params.id);
  await prisma.resource.delete({ where: { id } });
  res.json({ ok: true });
}

// ═══════════════════════════════════════════
// KULLANICI YÖNETİMİ (basit)
// ═══════════════════════════════════════════

// GET /api/admin/users
async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, plan: true, planExpiry: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ users });
}

// PUT /api/admin/users/:id  — role veya plan güncelle
async function updateUser(req, res) {
  const { id } = req.params;
  const { role, isActive, planExpiry } = req.body;
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role      !== undefined ? { role }      : {}),
      ...(isActive  !== undefined ? { isActive }  : {}),
      ...(planExpiry !== undefined ? { planExpiry: planExpiry ? new Date(planExpiry) : null } : {}),
    },
    select: { id: true, name: true, email: true, role: true, plan: true, planExpiry: true, isActive: true },
  });
  res.json({ user });
}

// ═══════════════════════════════════════════
// KURS YÖNETİMİ
// ═══════════════════════════════════════════

// GET /api/admin/courses
async function listCourses(req, res) {
  const courses = await prisma.course.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
  res.json({ courses });
}

// POST /api/admin/courses
async function createCourse(req, res) {
  const { slug, title, desc, icon, category, categoryLabel, gradient, accentColor, order } = req.body;
  if (!slug || !title) return res.status(400).json({ message: "slug ve title zorunlu." });
  try {
    const course = await prisma.course.create({
      data: { slug, title, desc, icon: icon || "🎓", category: category || "strateji", categoryLabel: categoryLabel || "Strateji", gradient: gradient || "from-yellow-900/40 to-amber-950/60", accentColor: accentColor || "#C9A84C", order: order || 0 },
    });
    res.json({ course });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "Bu slug zaten kullanılıyor." });
    throw err;
  }
}

// PUT /api/admin/courses/:id
async function updateCourse(req, res) {
  const id = parseInt(req.params.id);
  const { slug, title, desc, icon, category, categoryLabel, gradient, accentColor, order } = req.body;
  try {
    const course = await prisma.course.update({ where: { id }, data: { slug, title, desc, icon, category, categoryLabel, gradient, accentColor, order } });
    res.json({ course });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ message: "Kurs bulunamadı." });
    throw err;
  }
}

// DELETE /api/admin/courses/:id
async function deleteCourse(req, res) {
  const id = parseInt(req.params.id);
  await prisma.course.delete({ where: { id } });
  res.json({ ok: true });
}

module.exports = {
  listVideos, createVideo, updateVideo, deleteVideo, getUploadUrl,
  listArticles, createArticle, updateArticle, deleteArticle,
  listResources, createResource, updateResource, deleteResource,
  listUsers, updateUser,
  listCourses, createCourse, updateCourse, deleteCourse,
};
