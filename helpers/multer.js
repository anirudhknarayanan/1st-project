const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;

    // Choose destination based on route or fieldname
    if (req.originalUrl.includes("uploadProfileImage")) {
      uploadPath = path.join(__dirname, "../public/uploads/profile");
    } else if (req.baseUrl.includes("/admin") && req.originalUrl.includes("addProducts")) {
      uploadPath = path.join(__dirname, "../public/uploads/product-images");
    } else {
      uploadPath = path.join(__dirname, "../public/uploads/brands");
    }

    // Ensure the folder exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

module.exports = storage;
