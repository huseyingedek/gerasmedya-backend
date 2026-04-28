const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role || "user" },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "E-posta ve şifre zorunludur." });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(400).json({ message: "Bu e-posta ile kayıtlı kullanıcı bulunamadı." });


    if (!user.isActive)
      return res.status(403).json({ message: "Hesabınız aktif değil." });

    // Üyelik süresi kontrolü
    if (user.planExpiry && user.planExpiry < new Date()) {
      await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
      return res.status(403).json({ message: "Üyelik süreniz dolmuş. Lütfen yenileyin." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Şifre hatalı." });

    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan, role: user.role || "user" },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
}

// GET /api/auth/me
async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, plan: true, planExpiry: true, isActive: true, role: true },
    });
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    res.json({ user });
  } catch (err) {
    console.error("GetMe error:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
}

module.exports = { login, getMe };
