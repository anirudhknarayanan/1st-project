const express = require("express");
const router = express.Router();
const categoryController = require("../../controllers/admin/categoryController");
const {adminAuth} = require("../../middlewares/auth");

router.get("/", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer)
router.post("/removeCategoryOffer", adminAuth, categoryController.removeCategoryOffer)
router.patch("/toggleCategory/:id", adminAuth, categoryController.toggleCategoryStatus);
router.get("/editCategory/:id", adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.updateCategory);


module.exports = router;