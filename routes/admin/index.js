const express = require("express");
const router = express.Router();


router.use("/", require("./authRoute"));
router.use("/",require("./dashBoardRoute"))
router.use("/users",require("./customerRoute"))
router.use("/category",require("./categoryRoute"))
router.use("/brand",require("./brandRoute"))
router.use("/salesReport",require("./salesMangRoute"))
router.use("/coupons",require("./couponRoute"));
router.use("/products",require("./productRoute"));
router.use("/orders",require("./orderRoute"))





module.exports = router;
