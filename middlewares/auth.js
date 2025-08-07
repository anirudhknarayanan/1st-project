const User = require("../models/userSchema")
module.exports = {



  userAuth: async (req, res, next) => {
    try {
      const userId = req.session.user || (req.user && req.user._id);

      if (!userId) return res.redirect("/login");

      const user = await User.findById(userId);

      if (!user || user.isBlocked) {
        return res.redirect("/login");
      }

      req.currentUser = user; // optional: store user for reuse
      next();
    } catch (error) {
      console.error("Error in User auth middleware:", error);
      res.status(500).send("Internal Server Error");
    }
  },


  adminAuth: (req, res, next) => {
    if (req.session.admin) {
      User.findById(req.session.admin)
        .then((admin) => {
          if (admin && admin.isAdmin) {
            next();
          } else {
            res.redirect("/admin/login");
          }
        })
        .catch((error) => {
          console.log("Error in admin auth middleware:", error);
          res.status(500).send("Internal server error");
        });
    } else {
      res.redirect("/admin/login");
    }
  },
   checkUserBlocked : async (req, res, next) => {
  if (!req.session.user) return next();

  const user = await User.findById(req.session.user);
  if (!user || user.status === 'blocked') {
    req.session.destroy(() => {
      return res.redirect('user/login'); 
    });
  } else {
    next();
  }
},



}