const express = require("express");
const router  = express.Router();

const profileController = require("../../controllers/user/profileController");
const {userAuth} = require("../../middlewares/auth");

router.get("/addAddress", userAuth, profileController.addAddress);
router.post("/addAddress", userAuth, profileController.postAddress);
router.get("/editAddress/:id", userAuth, profileController.editAddress);
router.post("/editAddress/:id", userAuth, profileController.postEditAddress);
router.get("/deleteAddress/:id", userAuth, profileController.deleteAddress);




module.exports = router;