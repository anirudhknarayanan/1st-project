const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")

module.exports = {

    categoryInfo: async (req, res) => {

        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 4;
            const skip = (page - 1) * limit;
            const categoryData = await Category.find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .lean()
                .limit(limit)
            console.log(categoryData);


            const totalCategories = await Category.countDocuments()
            const totalPages = Math.ceil(totalCategories / limit);

            res.render("admin/category", {
                admin: true,
                cat: categoryData,
                currentPage: page,
                totalPages: totalPages,
                totalCategories: totalCategories
            });

        } catch (error) {

            console.error(error);
            res.redirect("/pageerror")
        }

    },

    addCategory: async (req, res) => {

        const { name, description, categoryOffer } = req.body; // ✅ Include categoryOffer

        try {
            const existingCategory = await Category.findOne({ name });
            if (existingCategory) {
                return res.status(400).json({ error: "Category already exists" });
            }

            const newCategory = new Category({
                name,
                description,
                categoryOffer
            });

            await newCategory.save();
            return res.json({ success: true, message: "Category added successfully" }); // ✅ consistent success response

        } catch (error) {

            console.error("Error adding category:", error); // ✅ Optional: log for debugging
            return res.status(500).json({ error: "Internal server error" });
        }
    },
    addCategoryOffer: async (req, res) => {

        try {
            const percentage = parseInt(req.body.percentage)
            const categoryId = req.body.categoryId;
            const category = await Category.findById(categoryId)

            if (!category) {
                return res.status(404).json({ status: false, message: "Category Not Found" })
            }

            const products = await Product.find({ category: category._id })
            const hasProductOffer = products.some((product) => product.productOffer > percentage);

            if (hasProductOffer) {
                return res.json({ status: false, message: "products with in this category have product offer" })
            }

            await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } })

            for (const product of products) {
                product.productOffer = 0;
                product.salePrice = product.regularPrice;
                await product.save();

            }

            res.json({ status: true })

        } catch (error) {
            res.status(500).json({ status: false, message: "internal server error" })

        }
    },

    removeCategoryOffer: async (req, res) => {
        try {
            const categoryId = req.body.categoryId;
            const category = await Category.findById(categoryId);

            if (!category) {
                res.status(404).json({ status: false, message: "category not found" })
            }
            const percentage = category.categoryOffer;
            const products = await Product.find({ category: category._id })

            if (products.length > 0) {
                for (const product of products) {
                    product.salePrice += Math.floor(product.regularPrice * (percentage / 100))
                    product.productOffer = 0;
                    await product.save()
                }
            }
            category.categoryOffer = 0;
            await category.save()
            res.json({ status: true })

        } catch (error) {
            res.status(500).json({ status: false, message: "internal server error" })
        }
    },

    toggleCategoryStatus: async (req, res) => {
        const { isListed } = req.body;
        const categoryId = req.params.id;

        try {
            const category = await Category.findByIdAndUpdate(
                categoryId,
                { isListed },
                { new: true }
            );

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }

            return res.status(200).json({
                success: true,
                message: `Category ${isListed ? "listed" : "unlisted"} successfully`,
                updatedCategory: category,
            });

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    },
    // Edit Category Page - GET

    getEditCategory: async (req, res) => {

        try {
            const id = req.params.id;


            const category = await Category.findById(id).lean();

            if (!category) {
                return res.status(404).send("Category not found");
            }


            res.render("admin/edit-category", {
                category,
                admin: true
            });

        } catch (error) {
            console.error("Error fetching category:", error);
            res.status(500).send("Server error");
        }
    },


    updateCategory: async (req, res) => {

        try {
            const id = req.params.id;
            const { name, description } = req.body
            await Category.updateOne(
                { _id: id },
                { $set: { name, description } }
            );

            res.redirect("/admin/category");

        } catch (error) {
            console.error("Error updating category:", error);
            res.status(500).send("Server error");
        }

    }

}