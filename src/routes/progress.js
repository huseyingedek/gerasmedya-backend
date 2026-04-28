const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { getProgress, toggleProgress, saveVideoPosition } = require("../controllers/progressController");

router.get("/", authMiddleware, getProgress);
router.post("/toggle", authMiddleware, toggleProgress);
router.post("/video-position", authMiddleware, saveVideoPosition);

module.exports = router;
