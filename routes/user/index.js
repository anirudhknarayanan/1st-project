const express = require("express");
const router = express.Router();

router.use("/",require("./authRoute"));
router.use("/",require("./profileRoute"));
router.use("/",require("./addressRoute"));
router.use("/",require("./forgotpasswordRoute"))
router.use("/",require("./productRoute"));
router.use("/",require("./wishlistRoute"));
router.use("/",require("./cartRoute"));
router.use("/",require("./checkoutRoute"));
router.use("/",require("./razorpayRoute"))

router.get("/about", (req, res) => {
    res.render("user/about")
})
router.get("/contact", (req, res) => {
    res.render("user/contact")
})


module.exports = router;