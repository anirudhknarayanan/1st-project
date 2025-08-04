const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");
const path = require("path")
const fs = require("fs")
const { countDocuments } = require("../../models/userSchema");

module.exports = {
    getBrandPage: async (req, res) => {

        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 4;
            const skip = (page - 1) * limit;
            const brandData = await Brand.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
            const totalBrand = await Brand.countDocuments();
            const totalPages = Math.ceil(totalBrand / limit);
            const reverseBrand = brandData.reverse();
            res.render("admin/brand", {
                admin: true,
                brand: reverseBrand,
                currentPage: page,
                totalPages: totalPages,
                totalBrand: totalBrand
            })

        } catch (error) {
            res.redirect("/pageerror")
        }
    },
    addBrand: async (req, res) => {

        try {
            const brand = req.body.name;
            console.log(brand);

            const findBrand = await Brand.findOne({
                brandName: { $regex: `^${brand}$`, $options: "i" }
            });


            if (findBrand) {
                return res.status(404).json({ success: false, message: "Brand already Exists" })

            }
            if (!req.file) {
                return res.status(400).json({ success: false, message: "Please upload a brand image" });
            }
            const image = req.file.filename;
            const newBrand = new Brand({
                brandName: brand,
                brandImage: image,
            })
            await newBrand.save()
            res.json({
                success: true,
                message: "Brand added successfully",
                brand: {
                    _id: newBrand._id,
                    brandName: newBrand.brandName,
                    brandImage: newBrand.brandImage,
                    isBlocked: false
                }
            });


        } catch (error) {

            console.log(error);
            return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });

        }
    },
    // POST - Block Brand
    blockBrand: async (req, res) => {
        try {
            const { id } = req.body;
            await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
            return res.status(200).json({ success: true, message: "Brand blocked successfully" });
        } catch (error) {
            console.error("error in block brand", error);
            return res.status(500).json({ success: false, message: "Something went wrong." });
        }
    },

    // POST - Unblock Brand
    unblockBrand: async (req, res) => {
        try {
            const { id } = req.body;
            await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
            return res.status(200).json({ success: true, message: "Brand unblocked successfully" });
        } catch (error) {
            console.error("error in unblock brand", error);
            return res.status(500).json({ success: false, message: "Something went wrong." });
        }
    },

    deleteBrand: async (req, res) => {
        try {
            const { id } = req.body;
            console.log(id)
            const brand = await Brand.findById(id);
            if (!brand) {
                return res.status(404).json({ success: false, message: "Brand not found" });
            }

            const brandImage = Array.isArray(brand.brandImage) ? brand.brandImage[0] : brand.brandImage;
            const imagePath = path.join(__dirname, '..', '..', 'public', 'uploads', 'brands', brandImage);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

            await Brand.deleteOne({ _id: id });
            return res.status(200).json({ success: true, message: "Brand deleted successfully" });
        } catch (error) {
            console.error("error in delete brand", error);
            return res.status(500).json({ success: false, message: "Something went wrong." });
        }
    }
}
