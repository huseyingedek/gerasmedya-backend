const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const { listCourses } = require("../controllers/courseController");

router.get("/", auth, listCourses);

module.exports = router;
