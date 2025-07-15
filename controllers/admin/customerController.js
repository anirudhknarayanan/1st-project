const User = require("../../models/userSchema");
const mongoose = require("mongoose");


module.exports = {

    getAllusers: async (req, res) => {
 try {

      let search = ""
      if (req.query.search) {
         search = req.query.search; //backendil llath access  cheyth serchik vekknnu

      }
      let page = 1
      if (req.query.page) {
         page = req.query.page
      }

      const limit = 5
      const userData = await User.find({
         isAdmin: false,
         $or: [
            { name: { $regex: ".*" + search + ".*" } },
            { email: { $regex: ".*" + search + ".*" } },

         ]
      })
      .sort({ createdAt: -1 }).lean()
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec()   // chain of promise combine cheyunnu
         

      const count = await User.find({
         isAdmin: false,
         $or: [

            { name: { $regex: ".*" + search + ".*" } },
            { email: { $regex: ".*" + search + ".*" } },

         ],

      }).countDocuments()

      const totalPages = Math.ceil(count / limit);

      res.render("admin/customers", {
        admin  : true,
         userData,
         totalPages: totalPages,
         currentPage: page,
         search: search
      });

   } catch (error) {
      console.error('Error in customerInfo:', error);
      res.redirect('/pageerror');
   }

    },
    userBlock: async (req, res) => {

        try {
            let id = req.params.id;
            await User.updateOne({ _id: id }, { $set: { isBlocked: true } })
            res.redirect("/admin/users")

        } catch (error) {
            res.redirect("/pageerror")
        }


    },

    userUnblock: async (req, res) => {
        try {
            let id = req.params.id;
            await User.updateOne({ _id: id }, { $set: { isBlocked: false } })
            res.redirect("/admin/users")

        } catch (error) {
            res.redirect("/pageerror")
        }

    },


}