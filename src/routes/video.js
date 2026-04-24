const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { listVideos, streamVideo } = require("../controllers/videoController");

// Video listesi — Bearer token ile
router.get("/", authMiddleware, listVideos);

// Video stream — query param token ile (HTML5 video tag custom header gönderemez)
router.get("/:slug/stream", streamVideo);

module.exports = router;
