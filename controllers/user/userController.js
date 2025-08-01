
const User = require("../../models/userSchema")
const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const Brand = require("../../models/brandSchema");
const Wishlist = require("../../models/wishlistSchema");
const Cart = require("../../models/cartSchema");
const env = require("dotenv").config()
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
// Import our referral helper functions
const {
    generateReferralCode,
    validateReferralCode,
    processReferralReward
} = require("../../helpers/referralHelpers")



function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}


async function sendverificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      html: `<b>Your OTP is: ${otp}</b>`
    });

    return info.accepted.length > 0;

  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    return passwordHash
  } catch (error) {

  }

}

module.exports = {
  pageNotFound: async (req, res) => {
    try {
      res.render("user/page-404", { hideFooter: true })
    } catch (error) {
      res.redirect("/pageNotFound")

    }
  },

  loadHomePage: async (req, res) => {
    try {
      const categories = await Category.find({ isListed: true }).lean();
      let productData = await Product.find({ isBlocked: false, category: { $in: categories.map(category => category._id) }, quantity: { $gt: 0 } }).lean();
      productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

      // productData = productData.slice(0, 4)
      console.log(productData);

      const user = req.session.user;
      if (user) {
        const userData = await User.findOne({ _id: user._id });
        
        // Get cart data for the user
        const Cart = require("../../models/cartSchema");
        const cart = await Cart.findOne({ userId: user }).lean();
        const cartProductIds = cart ? cart.items.map(item => item.productId.toString()) : [];
        
        // Get wishlist data for the user
        const Wishlist = require("../../models/wishlistSchema");
        const wishlist = await Wishlist.findOne({ userId: user }).lean();
        const wishlistProductIds = wishlist ? wishlist.items.map(item => item.productId.toString()) : [];
        
        return res.render("home", { 
          user: userData, 
          products: productData,
          cartProductIds: cartProductIds,
          wishlistProductIds: wishlistProductIds
        });
      } else {
        return res.render("home", { products: productData });
      }
    } catch (error) {
      console.log("home page not found");
      res.status(500).send("server error");
    }
  },

  signupPage: async (req, res) => {
    try {
      return res.render("user/userSignin", { hideFooter: true })
    } catch (error) {
      console.log("signin page not found");
      res.status(500).send("server error")

    }
  },
  signup: async (req, res) => {
    try {
      console.log(req.body);
      const { name, email, password, cpassword, phone, referralCode } = req.body;
      const existingEmail = await User.findOne({ email });
      const existingPhone = await User.findOne({ phone });

      if (existingEmail || existingPhone) {
        let message = "User already exists with ";
        if (existingEmail && existingPhone) {
          message += "this email and phone.";
        } else if (existingEmail) {
          message += "this email.";
        } else {
          message += "this phone.";
        }
        console.log("message");
        return res.render("user/userSignin", { message });
      }

      // Check if referral code is valid (if provided)
      let referrerData = null;
      if (referralCode && referralCode.trim()) {
        const referralValidation = await validateReferralCode(referralCode.trim().toUpperCase());
        if (!referralValidation.valid) {
          return res.render("user/userSignin", {
            message: "Invalid referral code. Please check and try again."
          });
        }
        referrerData = referralValidation.referrer;
        console.log("Valid referral code used:", referralCode, "Referrer:", referrerData.name);
      }

      const otp = generateOtp()


      const emailSent = sendverificationEmail(email, otp)
      console.log(emailSent);


      if (!emailSent) {
        return res.json("email - error")
      }
      req.session.userOtp = otp;
      req.session.userData = { password, email, name, phone, referrerData }
      res.render("user/verify-otp")
      console.log("otp send", otp);
    } catch (error) {
      console.log(error)
      res.redirect("/pageNotFound")
    }
  },
  verifyOtp: async (req, res) => {
    try {
      const { otp } = req.body
      console.log(otp);
      if (otp === req.session.userOtp) {
        const user = req.session.userData
        const passwordHash = await securePassword(user.password)
        // Generate unique referral code for new user
        const userReferralCode = await generateReferralCode(user.name);

        const saveUserDaTa = new User({
          name: user.name,
          email: user.email,
          phone: user.phone,
          password: passwordHash,
          referralCode: userReferralCode  // Give new user their own referral code
        })

        await saveUserDaTa.save()

        // If user was referred by someone, give reward to referrer
        if (user.referrerData) {
          try {
            const rewardResult = await processReferralReward(user.referrerData._id, saveUserDaTa._id);
            if (rewardResult.success) {
              console.log("✅ Referral reward given! Coupon:", rewardResult.couponCode);
            }
          } catch (error) {
            console.error("❌ Error processing referral rewards:", error);
          }
        }
        // req.session.user = saveUserDaTa._id;
        req.session.successMessage = "Signup successful! Please log in.";
        return res.redirect("/login");
      } else {
        return res.render("user/verify-otp", {
          message: "Invalid OTP. Please try again."
        });
      }

    } catch (error) {
      console.log("Error verify otp", error);
      res.status(500).json({ success: false, message: "An error occured" })


    }

  },
  resendOtp: async (req, res) => {
    try {
      const { email } = req.session.userData;
      if (!email) {
        return res.status(400).json({ success: false, message: "Email not found in session" })
      }
      const otp = generateOtp();
      req.session.userOtp = otp;

      const emailSent = await sendverificationEmail(email, otp)
      if (emailSent) {
        console.log("resend otp : ", otp);
        res.status(200).json({ success: true, message: "Otp resend successfully" })
      } else {
        res.status(500).json({ success: false, message: "Failed to resend otp,please sent again" })
      }

    } catch (error) {
      console.error("Error resending Otp ", error);
      res.status(500).json({ success: false, message: "Internal Server Error . please try again" })


    }

  },
  login: async (req, res) => {
    try {
      if (req.session.user) {
        res.redirect("/")
      } else {
        const message = req.session.successMessage;
        delete req.session.successMessage;
        return res.render("user/userLogin", { hideFooter: true, message })

      }
    } catch (error) {
      res.redirect("/pageNotFound")

    }

  },
  postLogin: async (req, res) => {
    try {
      console.log(req.body);

      const { email, password } = req.body;
      const findUser = await User.findOne({ isAdmin: 0, email: email })
      console.log("HII", findUser);

      if (!findUser) {
        res.render("user/userLogin", { message: "user not found" })
      }
      if (findUser.isBlocked) {
        return res.render("user/userLogin", { message: "blocked by admin" })
      }
      const passwordMatch = await bcrypt.compare(password, findUser.password)
      if (!passwordMatch) {
        return res.render("user/userLogin", { message: "incorrect password" })
      }
      req.session.user = findUser._id
      res.redirect("/")
    } catch (error) {
      console.error("loggin error")
      res.render("user/userLogin", { message: "loggin failed please try again" })

    }
  },

  logout: async (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).send("logout failed")
        } else {
          res.redirect("/login")
        }
      })
    } catch (error) {
      console.log("logout error");
      res.redirect("/pageNotFound")


    }
  },
  loadShoppingPage: async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.redirect("/login");

      const UserData = await User.findOne({ _id: user }).lean();
      const categories = await Category.find({ isListed: true }).lean();
      console.log("this is cat", categories)
      const categoryIds = categories.map((category) => category._id.toString());

      const page = parseInt(req.query.page) || 1;
      const limit = 6; // change as needed
      const skip = (page - 1) * limit;

      const products = await Product.find({
        isBlocked: false,
        category: { $in: categoryIds },

      })
        .populate('category') // Populate category to get category offers
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalProducts = await Product.countDocuments({
        isBlocked: false,
        category: { $in: categoryIds },
        quantity: { $gt: 0 },
      });

      const totalPages = Math.ceil(totalProducts / limit);
      const brands = await Brand.find({ isBlocked: false }).lean();
      console.log(brands);

      const categoriesWithIds = categories.map((category) => ({
        _id: category._id,
        name: category.name,
      }));
      console.log("cate dshhsdgds", categoriesWithIds)

      // Calculate offer information for each product
      const { getDiscountPrice } = require("../../helpers/offerHelpers");
      const productsWithOffers = products.map(product => {
        const offerData = getDiscountPrice(product);
        return {
          ...product,
          appliedOffer: offerData?.appliedOffer || 0,
          appliedOfferType: offerData?.appliedOfferType || null,
          hasOffer: (offerData?.appliedOffer || 0) > 0
        };
      });

      // Get wishlist data for the user
      
      const wishlist = await Wishlist.findOne({ userId: user }).lean();
      const wishlistProductIds = wishlist ? wishlist.items.map(item => item.productId.toString()) : [];

      // Get cart data for the user
      
      const cart = await Cart.findOne({ userId: user }).lean();
      const cartProductIds = cart ? cart.items.map(item => item.productId.toString()) : [];

      console.log('Cart Product IDs:', cartProductIds);
      console.log('First few product IDs from products:', productsWithOffers.slice(0, 3).map(p => ({ id: p._id.toString(), name: p.name })));

      // Add isInCart flag to each product for easier template logic
      const productsWithCartStatus = productsWithOffers.map(product => ({
        ...product,
        isInCart: cartProductIds.includes(product._id.toString())
      }));

      res.render("user/shopp", {
        user: UserData,
        products: productsWithCartStatus, // Use products with cart status
        category: categoriesWithIds,
        brand: brands,
        totalProducts: totalProducts,
        currentPage: page,
        totalPages: totalPages,
        wishlistProductIds: wishlistProductIds, // Pass wishlist product IDs
        cartProductIds: cartProductIds // Pass cart product IDs
      });
    } catch (error) {
      console.error(error);
      res.redirect("user/pageNotFound");
    }
  },

  filterProduct: async (req, res) => {
    try {
      const user = req.session.user;
      const category = req.query.category;
      const brand = req.query.brand;

      const findCategory = category ? await Category.findOne({ _id: category }) : null;
      const findBrand = brand ? await Brand.findOne({ _id: brand }) : null;
      const brands = await Brand.find({}).lean();

      const query = {
        isBlocked: false,
        quantity: { $gt: 0 }
      };

      if (findCategory) {
        query.category = findCategory._id;
      }

      if (findBrand) {
        query.brand = findBrand.brandName;
      }

      let findProducts = await Product.find(query).lean();
      findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

      const categories = await Category.find({ isListed: true }).lean();

      const itemsPerPage = 6;
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const totalPages = Math.ceil(findProducts.length / itemsPerPage);
      const currentProduct = findProducts.slice(startIndex, endIndex);

      let userData = null;

      if (user) {
        userData = await User.findOne({ _id: user });
        if (userData) {
          const searchEntry = {
            category: findCategory ? findCategory._id : null,
            brand: findBrand ? findBrand.brandName : null,
            searchOn: new Date()
          };

          if (!userData.searchHistory) {
            userData.searchHistory = [];
          }

          userData.searchHistory.push(searchEntry);
          await userData.save();
        }
      }
      req.session.filteredProduct = currentProduct;

      // ✅ ADD: Calculate offer information for filtered products
      const { getDiscountPrice } = require("../../helpers/offerHelpers");
      const productsWithOffers = currentProduct.map(product => {
        const offerData = getDiscountPrice(product);
        return {
          ...product,
          appliedOffer: offerData?.appliedOffer || 0,
          appliedOfferType: offerData?.appliedOfferType || null,
          hasOffer: (offerData?.appliedOffer || 0) > 0
        };
      });

      // Fetch wishlist data
      const Wishlist = require('../../models/wishlistSchema');
      const wishlist = await Wishlist.findOne({ userId: user }).lean();
      const wishlistProductIds = wishlist ? wishlist.items.map(item => item.productId.toString()) : [];

      res.render("user/shopp", {
        user: userData,
        products: productsWithOffers, // ✅ UPDATED: Use products with offer information
        category: categories,
        brand: brands,
        totalPages: totalPages,
        currentPage: currentPage,
        selectedCategory: category || null,
        selectedBrand: brand || null,
        wishlistProductIds: wishlistProductIds
      });

    } catch (error) {
      console.error(error);
      res.redirect("/pageNotFound");
    }
  },


  filterByPrice: async (req, res) => {
    try {
      const user = req.session.user;
      const userData = user ? await User.findOne({ _id: user }) : null;
      const brands = await Brand.find({}).lean();
      const categories = await Category.find({ isListed: true }).lean();

      const minPrice = Number(req.query.gt);
      const maxPrice = Number(req.query.lt);

      const findProducts = await Product.find({
        salePrice: { $gte: minPrice, $lte: maxPrice },
        isBlocked: false,
        quantity: { $gt: 0 },
      })
        .sort({ createdOn: -1 })
        .lean();

        console.log("findProducts : ",findProducts)

      const itemsPerPage = 6;
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const totalPages = Math.ceil(findProducts.length / itemsPerPage);
      const currentProduct = findProducts.slice(startIndex, endIndex);

      req.session.filteredProduct = findProducts;

      // ✅ ADD: Calculate offer information for price filtered products
      const { getDiscountPrice } = require("../../helpers/offerHelpers");
      const productsWithOffers = currentProduct.map(product => {
        const offerData = getDiscountPrice(product);
        return {
          ...product,
          appliedOffer: offerData?.appliedOffer || 0,
          appliedOfferType: offerData?.appliedOfferType || null,
          hasOffer: (offerData?.appliedOffer || 0) > 0
        };
      });

      // Fetch wishlist data
      const Wishlist = require('../../models/wishlistSchema');
      const wishlist = await Wishlist.findOne({ userId: user }).lean();
      const wishlistProductIds = wishlist ? wishlist.items.map(item => item.productId.toString()) : [];

      res.render("user/shopp", {
        user: userData,
        products: productsWithOffers, // ✅ UPDATED: Use products with offer information
        category: categories,
        brand: brands,
        totalPages,
        currentPage,
        wishlistProductIds: wishlistProductIds
      });
    } catch (error) {
      console.error(error);
      res.redirect("/pageNotFound");
    }
  },
  searchProducts: async (req, res) => {
    try {
      const user = req.session.user;
      const userData = await User.findOne({ _id: user })
      let search = req.body.query;
      console.log("🔍 SEARCH DEBUG - Search term:", search);

      const brands = await Brand.find({}).lean();
      const categories = await Category.find({ isListed: true }).lean();
      const categoryIds = categories.map((category) => category._id.toString());
      console.log("🔍 SEARCH DEBUG - Available categories:", categoryIds.length);

      let searchResult = [];

      // ✅ ALWAYS SEARCH IN DATABASE, NOT FILTERED PRODUCTS
      console.log("🔍 SEARCH DEBUG - Searching in database for all products");

      // ✅ IMPROVED: Search in both product name AND brand name
      const searchRegex = new RegExp(search.trim(), "i"); // More robust regex

      searchResult = await Product.find({
        $and: [
          {
            $or: [
              { productName: { $regex: searchRegex } },  // Search in product name
              { brand: { $regex: searchRegex } }         // Search in brand name
            ]
          },
          { isBlocked: false },
          { category: { $in: categoryIds } }
        ]
      }).populate('category').lean()

      console.log("🔍 SEARCH DEBUG - Search regex pattern:", searchRegex);
      console.log("🔍 SEARCH DEBUG - Searching for products containing:", search.trim());

      console.log("🔍 SEARCH DEBUG - Total products in database:", await Product.countDocuments());
      console.log("🔍 SEARCH DEBUG - Products matching search:", searchResult.length);

      // ✅ DEBUG: Check all products that contain the search term (ignoring other filters)
      const allMatchingProducts = await Product.find({
        $or: [
          { productName: { $regex: searchRegex } },
          { brand: { $regex: searchRegex } }
        ]
      }).lean();
      console.log("🔍 SEARCH DEBUG - All products/brands containing '" + search + "' (ignoring filters):", allMatchingProducts.length);
      allMatchingProducts.forEach(p => {
        console.log(`  - ${p.productName} | Brand: ${p.brand} (blocked: ${p.isBlocked}, category: ${p.category})`);
      });

      // ✅ DEBUG: Show final results
      console.log("🔍 SEARCH DEBUG - Final filtered results:");
      searchResult.forEach(p => {
        console.log(`  ✅ ${p.productName} | Brand: ${p.brand}`);
      });
      console.log("🔍 SEARCH DEBUG - Search results found:", searchResult.length);

      if (searchResult.length > 0) {
        console.log("🔍 SEARCH DEBUG - First result:", searchResult[0].productName);
      }

      searchResult.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

      const itemsPerPage = 6;
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const totalPages = Math.ceil(searchResult.length / itemsPerPage);
      const currentProduct = searchResult.slice(startIndex, endIndex);

      // ✅ ADD: Calculate offer information for search results
      const { getDiscountPrice } = require("../../helpers/offerHelpers");
      const productsWithOffers = currentProduct.map(product => {
        const offerData = getDiscountPrice(product);
        return {
          ...product,
          appliedOffer: offerData?.appliedOffer || 0,
          appliedOfferType: offerData?.appliedOfferType || null,
          hasOffer: (offerData?.appliedOffer || 0) > 0
        };
      });

      // Fetch wishlist data
      const Wishlist = require('../../models/wishlistSchema');
      const wishlist = await Wishlist.findOne({ userId: user }).lean();
      const wishlistProductIds = wishlist ? wishlist.items.map(item => item.productId.toString()) : [];

      res.render("user/shopp", {
        user: userData,
        products: productsWithOffers, // ✅ UPDATED: Use products with offer information
        category: categories,
        brand: brands,
        totalPages,
        currentPage,
        count: searchResult.length,
        wishlistProductIds: wishlistProductIds
      })

    }

    catch (error) {
      console.log(error);
      res.redirect("/pageNotFound")

    }
  }


}