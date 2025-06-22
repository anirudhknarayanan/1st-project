const User = require("../../models/userSchema");
const mongoose = require("mongoose");


module.exports = {

    getAllusers : async (req,res)=>{
        
        
        try {
            let search = "";
            if(req.query.search){
                search =req.query.search;
            }
            let page = 1;
            if(req.query.page){
                page = req.query.page
            }
            const limit = 3
            const userData =await User.find({
                isAdmin : false,
                $or : [{name : {$regex : ".*" + search +".*"}},{email : {$regex : ".*" + search +".*"}}],

            }) .limit(limit*1)
            .skip((page-1)*limit)
            .lean()
            .exec();
        
            

            const count = await User.find({
                  isAdmin : false,
                $or : [{name : {$regex : ".*" + search +".*"}},{email : {$regex : ".*" + search +".*"}}],
            }).countDocuments();
            res.render("admin/customers",{admin : true,userData})
        } catch (error) {
            
            
             console.log("Error in getAllusers:", error);
             res.redirect("/admin");
        }

    },
    userBlock : async (req,res)=>{
        try {
            let id = req.params.id;
        await User.updateOne({_id : id},{$set:{isBlocked : true}})
        res.redirect("/admin/users")
            
        } catch (error) {
            res.redirect("/pageerror")
        }
        
        
    },
    userUnblock : async (req,res)=>{
        try {
             let id = req.params.id;
        await User.updateOne({_id : id},{$set:{isBlocked : false}})
        res.redirect("/admin/users")

        } catch (error) {
            res.redirect("/pageerror")
        }
       
    },
   

}