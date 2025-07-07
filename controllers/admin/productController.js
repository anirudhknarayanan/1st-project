const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path");
const sharp = require("sharp")

module.exports = {
    // getAllproducts :async (req,res)=>{

    // }
    addProductpage: async (req, res) => {
        try {
            const category = await Category.find({ isListed: true }).lean();
            const brand = await Brand.find({ isBlocked: false }).lean();
            res.render("admin/addProduct", { admin: true, category: category, brand: brand })
        } catch (error) {
            res.redirect("/pageerror")
        }

    },
    addProduct: async (req, res) => {
        try {
            const product = req.body;


            if (product.quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "invalid quantity"
                })
            }


            // Check if product already exists
            const productExists = await Product.findOne({ productName: product.productName });
            if (productExists) {
                return res.status(400).json("Product already exists, try another name");
            }

            // Handle product images
            const images = [];
            const productImagesPath = path.join("public", "uploads", "product-images");
            if (!fs.existsSync(productImagesPath)) {
                fs.mkdirSync(productImagesPath, { recursive: true });
            }

            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const originalImagePath = file.path;
                    const resizedImagePath = path.join(productImagesPath, file.filename);
                    await sharp(originalImagePath)
                         .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);
                    images.push(file.filename);
                }
            }

            // Get category by name
            const categoryDoc = await Category.findById(product.category);
            if (!categoryDoc) {
                return res.status(400).json("Invalid category name");
            }

            // Get brand name from ID
            const brandDoc = await Brand.findById(product.brand);
            if (!brandDoc) {
                return res.status(400).json("Invalid brand");
            }

            // Create new product
            const newProduct = new Product({
                productName: product.productName,
                description: product.description,
                brand: brandDoc.brandName, // Store name instead of ObjectId
                category: categoryDoc._id,
                regularPrice: product.regularPrice,
                salePrice: product.salePrice,
                createdOn: new Date(),
                quantity: product.quantity,
                size: product.size,
                color: product.color,
                productImage: images,
                status: 'Available'
            });

            await newProduct.save();
            return res.status(200).json({
                success: true,
                message: 'Product added successfully'
            });

        } catch (error) {
            console.error("Error adding product:", error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    getAllProducts: async (req, res) => {
        try {
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const limit = 4;

            const productData = await Product.find
            ({
                $or: [
                    { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                    { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },

                ],

            }).populate("category")
            .sort({ createdAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit)
                .lean();
            console.log(productData);

            const count = await Product.find({
                $or: [
                    { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                    { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },

                ],
            }).countDocuments();

            const category = await Category.find({ isListed: true }).lean()
            const brand = await Brand.find({ isBlocked: false }).lean()
            if (category.length > 0 && brand.length > 0) {
                res.render("admin/products", {
                    admin: true,
                    data: productData,
                    currentPage: page,
                    totalPages: Math.ceil(count / limit),
                    searchTerm: search,
                    category: category,
                    brand: brand,

                })
            } else {
                res.rendirect("/pageerror");
            }
        } catch (error) {
            console.log(error)
            res.redirect("/pageerror")
        }
    },
    addProductOffer: async (req, res) => {
        try {
            const { productId, percentage } = req.body
            console.log(productId, percentage);
            const findProduct = await Product.findOne({ _id: productId })
            if (!findProduct) {
                return res.status(404).json({ status: false, message: "Product not found" });
            }
            const findCategory = await Category.findOne({ _id: findProduct.category })
            if (!findCategory) {
                return res.status(404).json({ status: false, message: "Category not found" });
            }

            if (findCategory.categoryOffer && findCategory.categoryOffer > percentage) {
                return res.json({ status: false, message: "This product already has a better category offer" });
            }


            findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice * (percentage / 100));

            findProduct.productOffer = parseInt(percentage)
            await findProduct.save();
            findCategory.categoryOffer = 0;
            await findCategory.save()
            res.json({ status: true });

        } catch (error) {

            res.status(500).json({ status: false, message: "internal server error" })

        }
    },
    removeProductOffer: async (req, res) => {
        try {
            const { productId } = req.body;
            const findProduct = await Product.findOne({ _id: productId })
            if (!findProduct) {
                return res.json({ status: false, message: "Product not found" });
            }

            findProduct.salePrice = findProduct.regularPrice;
            findProduct.productOffer = 0;
            await findProduct.save()
            res.json({ status: true })
        } catch (error) {
            console.error("Error in removeProductOffer:", error);
            res.status(500).json({ status: false, message: "Internal server error" });
        }
    },
    blockProduct: async (req, res) => {
        try {
            const id = req.params.id
            await Product.updateOne({ _id: id }, { $set: { isBlocked: true } })
            res.redirect("/admin/products")
        } catch (error) {
            console.log("Error in blockProduct:", error);
            res.redirect("/pageerror")
        }
    },
    unblockProduct: async (req, res) => {
        try {
            const id = req.params.id;
            await Product.updateOne({ _id: id }, { $set: { isBlocked: false } })
            res.redirect("/admin/products")
        } catch (error) {
            console.log("Error in unblockProduct:", error);
            res.redirect("/pageerror")
        }
    },
    getEditProduct: async (req, res) => {
        try {
            const id = req.query.id;
            const product = await Product.findOne({ _id: id })
                .lean();
            // console.log("hii",product);
            console.log("Brand ID:", product.brand._id);
            console.log("Brand Name:", product.brand.brandName);

            const category = await Category.find().lean();
            const brand = await Brand.find().lean();
            res.render("admin/edit-product", {
                admin: true,
                product: product,
                category: category,
                brand: brand
            })


        } catch (error) {
            console.log("getting edit product issue");

            res.redirect("/pageerror");
        }
    },


    editProduct: async (req, res) => {
        try {
            const id = req.params.id;
            const data = req.body;
            let deletedImages = [];

            console.log("req.body", data)


            try {
                deletedImages = data.deletedImages ? JSON.parse(data.deletedImages) : [];
            } catch (error) {
                console.error('Error parsing deletedImages:', error);
            }

            if (!data.productName || !data.category || !data.regularPrice || !data.salePrice || !data.brand) {
                return res.status(400).json({
                    success: false,
                    message: 'Product Name, Category, Regular Price, Sale Price, and Brand are required'
                });
            }

            const existingProduct = await Product.findById(id);
            if (!existingProduct) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            const regularPrice = parseFloat(data.regularPrice);
            const salePrice = parseFloat(data.salePrice);

            if (isNaN(regularPrice) || isNaN(salePrice) || regularPrice <= 0 || salePrice <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid price values'
                });
            }
            console.log("this is your existing quantity", data.quantity);

            if (data.quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "invalid quantity"
                })
            }

            // const categoryId = await Category.findOne({ name: data.category });
            const categoryId = await Category.findOne({ _id: data.category });

            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message: 'Category not found'
                });
            }
            const brand = await Brand.findById(data.brand);
            if (!brand) {
                return res.status(400).json({
                    success: false,
                    message: 'Brand not found'
                });
            }

            const remainingImages = existingProduct.productImage.filter(
                image => !deletedImages.includes(image)
            );

            const newImages = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const originalImagePath = file.path;
                    const resizedImagePath = path.join("public", "uploads", "product-images", `resized-${file.filename}`);
                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);
                    newImages.push(`resized-${file.filename}`);
                }
            }


            const croppedImages = [];
            for (let i = 1; i <= 4; i++) {
                const croppedImageKey = `croppedImage${i}`;
                if (data[croppedImageKey]) {
                    const base64Data = data[croppedImageKey].replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');
                    const filename = `cropped-${Date.now()}-${i}.jpg`;
                    const filepath = path.join("public", "uploads", "product-images", filename);

                    await fs.promises.writeFile(filepath, buffer);
                    croppedImages.push(filename);
                }
            }

            const updatedImages = [...remainingImages, ...newImages, ...croppedImages];

            if (updatedImages.length < 3 || updatedImages.length > 4) {
                return res.status(400).json({
                    success: false,
                    message: 'You must have between 3 and 4 images'
                });
            }


            existingProduct.productName = data.productName;
            existingProduct.description = data.description;
            existingProduct.category = categoryId._id;
            existingProduct.brand = brand.brandName;
            existingProduct.regularPrice = regularPrice;
            existingProduct.salePrice = salePrice;
            existingProduct.quantity = data.quantity;
            existingProduct.size = data.size;
            existingProduct.isListed = data.isListed === 'true';
            existingProduct.productImage = updatedImages;


            await existingProduct.save();


            for (const imageName of deletedImages) {
                try {
                    const imagePath = path.join("public", "uploads", "product-images", imageName);
                    await fs.promises.unlink(imagePath);
                } catch (unlinkError) {
                    console.error(`Error deleting image ${imageName}:`, unlinkError);
                }
            }

            return res.status(200).json({
                success: true,
                message: "Product updated successfully"
            });

        } catch (error) {
            console.error("Error editing product:", error);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },
    deleteSigleImage: async (req, res) => {
        try {
            const { imageNameToServer, productIdToServer } = req.body;

            // Remove the image from productImage array
            const product = await Product.findByIdAndUpdate(
                productIdToServer,
                { $pull: { productImage: imageNameToServer } }
            );

            // Delete image file from disk
            const imagePath = path.join("public", "uploads", "product-images", imageNameToServer);

            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath); // Removed await
                console.log(`Image ${imageNameToServer} deleted successfully`);
            } else {
                console.log("Image file not found at:", imagePath);
            }

            res.send({ status: true });

        } catch (error) {
            console.error("Error in deleteSigleImage:", error);
            res.redirect("/pageerror");
        }
    },
    deleteProduct: async (req, res) => {
        try {
            const { productId } = req.body;

            const product = await Product.findById(productId);

            if (!product) {
                return res.status(404).json({ status: false, message: "Product not found" });
            }

            // Get product images array
            const productImages = product.productImage;

            // Construct directory path
            const imageDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'product-images');

            // Loop and delete each image
            for (let image of productImages) {
                const imagePath = path.join(imageDir, image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }

            // Delete product document
            await Product.deleteOne({ _id: productId });

            return res.status(200).json({ status: true, message: "Product and images deleted successfully" });
        } catch (error) {
            console.error("Error deleting product:", error);
            return res.status(500).json({ status: false, message: "Something went wrong. Please try again." });
        }
    }

}