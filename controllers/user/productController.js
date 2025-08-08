const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema")


module.exports = {
    productDetails: async (req, res) => {
        try {
            const userId = req.session.user;
            const userData = await User.findById(userId).lean()
            const productId = req.query.id;
            console.log("its my productId", productId)
            const product = await Product.findById(productId).populate('category').lean()
            console.log(product);

             if (!product || product.isBlocked) {
      return res.status(404).render("user/page-404", {
        user: userData,
        message: "Product not found or is blocked",
      });
    }

            const findCategory = product.category;
            const categoryOffer = findCategory?.categoryOffer || 0;
            const productOffer = product.productOffer || 0;
            const totalOffer = categoryOffer + productOffer;
            console.log(userData)
            res.render("user/product-details", {
                user: userData,
                product: product,
                quantity: product.quantity,
                totalOffer: totalOffer,
                category: findCategory,

            })

        } catch (error) {
            console.error("Error fetching product details", error);

            res.redirect("/pageNotFound")
        }

    }
}