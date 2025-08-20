const Wishlist = require("../models/wishlistSchema");

module.exports = {
    WishlistCount : async(req,res,next)=>{
        res.locals.user = req.session.user || null;
        res.locals.WishlistCount = 0;

        if(req.session.user){
            try {
                const userWishlist = await Wishlist.findOne({userId : req.session.user});
                res.locals.wishlistCount = userWishlist ? userWishlist.items.length : 0;
            } catch (error) {
                 console.error('Error loading wishlist count:', err);
            }
        }
        next();
    }
} 
