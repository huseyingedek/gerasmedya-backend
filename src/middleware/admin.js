const prisma = require("../prisma");

// Auth middleware'den sonra çalışır — req.user.id dolu olmalı
module.exports = async function adminMiddleware(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Yetkisiz erişim." });
    }
    next();
  } catch {
    return res.status(500).json({ message: "Yetki kontrolü başarısız." });
  }
};
