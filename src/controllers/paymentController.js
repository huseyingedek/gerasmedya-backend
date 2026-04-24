const Iyzipay = require("iyzipay");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

let iyzipay = null;

if (process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY) {
  iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY,
    secretKey: process.env.IYZICO_SECRET_KEY,
    uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com",
  });
}

const PLANS = {
  aylik:  { price: "499.00",  amount: 499,  currency: "TRY", days: 30,  prismaEnum: "AYLIK"  },
  yillik: { price: "3990.00", amount: 3990, currency: "TRY", days: 365, prismaEnum: "YILLIK" },
};

// POST /api/payment/create
async function createPayment(req, res) {
  try {
    const { plan, user, card } = req.body;

    // Validasyon
    if (!plan || !user?.email || !user?.password || !card?.number)
      return res.status(400).json({ message: "Eksik bilgi gönderildi." });

    const planInfo = PLANS[plan];
    if (!planInfo)
      return res.status(400).json({ message: "Geçersiz plan." });

    // E-posta mükerrer kontrolü
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing)
      return res.status(400).json({ message: "Bu e-posta adresi zaten kayıtlı." });

    const conversationId = `geras-${Date.now()}`;

    // iyzico ödeme isteği
    const iyziRequest = {
      locale: Iyzipay.LOCALE.TR,
      conversationId,
      price: planInfo.price,
      paidPrice: planInfo.price,
      currency: planInfo.currency,
      installment: "1",
      basketId: `basket-${Date.now()}`,
      paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
      paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,

      paymentCard: {
        cardHolderName: card.holder,
        cardNumber: card.number,
        expireMonth: card.expireMonth,
        expireYear: card.expireYear,
        cvc: card.cvv,
        registerCard: "0",
      },

      buyer: {
        id: `buyer-${Date.now()}`,
        name: user.name.split(" ")[0] || user.name,
        surname: user.name.split(" ").slice(1).join(" ") || "-",
        email: user.email,
        identityNumber: "74300864791", // sandbox sabit — canlıda TC ekle
        gsmNumber: user.phone || "+905000000000",
        registrationAddress: "Türkiye",
        ip: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
        city: "Istanbul",
        country: "Turkey",
      },

      shippingAddress: { contactName: user.name, city: "Istanbul", country: "Turkey", address: "Türkiye" },
      billingAddress:  { contactName: user.name, city: "Istanbul", country: "Turkey", address: "Türkiye" },

      basketItems: [{
        id: plan,
        name: `Geras Medya Panel — ${planInfo.prismaEnum === "YILLIK" ? "Yıllık" : "Aylık"} Plan`,
        category1: "Dijital Eğitim",
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: planInfo.price,
      }],
    };

    // ── TEST MODU: iyzico anahtarı yoksa direkt geç ──
    const isTestMode = !process.env.IYZICO_API_KEY || process.env.IYZICO_API_KEY.includes("xxx");

    const processSuccess = async (paymentId = "TEST-" + Date.now()) => {
      // ── Ödeme başarılı ──
      try {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        const planExpiry = new Date(Date.now() + planInfo.days * 24 * 60 * 60 * 1000);

        // Kullanıcı oluştur
        const newUser = await prisma.user.create({
          data: {
            name: user.name,
            email: user.email,
            password: hashedPassword,
            plan: planInfo.prismaEnum,
            planExpiry,
            isActive: true,
          },
        });

        // Ödeme kaydı
        await prisma.payment.create({
          data: {
            userId: newUser.id,
            plan: planInfo.prismaEnum,
            amount: planInfo.amount,
            iyzicoPaymentId: paymentId,
            conversationId,
            status: "SUCCESS",
          },
        });

        // JWT token
        const token = jwt.sign(
          { id: newUser.id, email: newUser.email, name: newUser.name, plan: newUser.plan },
          process.env.JWT_SECRET,
          { expiresIn: planInfo.prismaEnum === "YILLIK" ? "365d" : "30d" }
        );

        return res.status(200).json({
          success: true,
          message: "Ödeme başarılı, hesabınız oluşturuldu.",
          token,
          user: { id: newUser.id, name: newUser.name, email: newUser.email, plan: newUser.plan },
        });

      } catch (dbErr) {
        console.error("DB hatası:", dbErr?.message || dbErr);
        return res.status(500).json({
          message: dbErr?.message || "Hesap oluşturulamadı.",
        });
      }
    };

    if (isTestMode) {
      console.log("⚠️  TEST MODU — iyzico atlandı, direkt kullanıcı oluşturuluyor.");
      return processSuccess();
    }

    iyzipay.payment.create(iyziRequest, async (err, result) => {
      if (err || result.status !== "success") {
        console.error("iyzico hata:", result?.errorMessage || err);
        return res.status(400).json({
          message: result?.errorMessage || "Ödeme başarısız.",
          errorCode: result?.errorCode,
        });
      }
      processSuccess(result.paymentId);
    });

  } catch (err) {
    console.error("Payment controller error:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
}

module.exports = { createPayment };
