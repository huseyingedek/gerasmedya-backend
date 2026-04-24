require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || "https://panel.gerasonline.com",
  process.env.PANEL_URL    || "https://medya.gerasonline.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("CORS: İzin verilmeyen kaynak."));
  },
  credentials: true,
}));

app.use(express.json());

// ── Routes
app.use("/api/auth",    require("./routes/auth"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/videos",  require("./routes/video"));

// ── Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "Geras Medya API", version: "1.0.0" });
});

// ── 404
app.use((req, res) => {
  res.status(404).json({ message: "Route bulunamadı." });
});

// ── Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Sunucu hatası." });
});

app.listen(PORT, () => {
  console.log(`✅ Geras Medya API çalışıyor → http://localhost:${PORT}`);
});
