const express       = require("express");
const router        = express.Router();
const auth          = require("../middleware/auth");
const adminCheck    = require("../middleware/admin");
const ctrl          = require("../controllers/adminController");

// Tüm admin route'ları hem auth hem admin kontrolünden geçer
router.use(auth, adminCheck);

// ── Videolar
router.get   ("/videos",          ctrl.listVideos);
router.post  ("/videos",          ctrl.createVideo);
router.put   ("/videos/:id",      ctrl.updateVideo);
router.delete("/videos/:id",      ctrl.deleteVideo);
router.get   ("/upload-url",      ctrl.getUploadUrl);  // presigned R2 URL

// ── Yazılar
router.get   ("/articles",        ctrl.listArticles);
router.post  ("/articles",        ctrl.createArticle);
router.put   ("/articles/:id",    ctrl.updateArticle);
router.delete("/articles/:id",    ctrl.deleteArticle);

// ── Kaynaklar
router.get   ("/resources",       ctrl.listResources);
router.post  ("/resources",       ctrl.createResource);
router.put   ("/resources/:id",   ctrl.updateResource);
router.delete("/resources/:id",   ctrl.deleteResource);

// ── Kullanıcılar
router.get   ("/users",           ctrl.listUsers);
router.put   ("/users/:id",       ctrl.updateUser);

// ── Kurslar
router.get   ("/courses",         ctrl.listCourses);
router.post  ("/courses",         ctrl.createCourse);
router.put   ("/courses/:id",     ctrl.updateCourse);
router.delete("/courses/:id",     ctrl.deleteCourse);

module.exports = router;
