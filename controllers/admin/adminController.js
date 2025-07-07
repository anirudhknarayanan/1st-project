const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");



module.exports = {
    adminLogin: async (req, res) => {
        try {
            if (req.session.admin) {
                res.redirect("/")
            }
            res.render("admin/admin-login", { hideFooter: true })
        } catch (error) {
            res.status(404).send("server error")

        }


    },
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            console.log("hii", req.body);

            const admin = await User.findOne({ email: email, isAdmin: true })
            if (admin) {
                console.log("admin :", admin);

                const passwordMatch = await bcrypt.compare(password, admin.password)
                if (passwordMatch) {
                    req.session.admin = admin._id;
                    console.log("hey thre");

                    res.redirect("/admin")
                } else {
                    console.log("uighis");

                    return res.redirect("/admin/login")
                }
            } else {
                console.log("hii");

                return res.redirect("/admin/login")
            }
        } catch (error) {
            console.log("login error", error);
            return res.redirect("/pageerror")

        }

    },
    loadDashBoard: async (req, res) => {

        try {

            console.log("admin is there");
            res.render("admin/dashboard", { admin: true })

        } catch (error) {
            res.redirect("/pageerror")

        }
    },


    getPageerror: async (req, res) => {
        res.render("admin/admin-error", { admin: true })
    },


    logout: async (req, res) => {

        try {
            req.session.destroy((err) => {
                if (err) {
                    return res.status(500).send("logout failed")
                } else {
                    res.redirect("/admin/login")
                }
            })
        } catch (error) {
            console.log("logout error");
            res.redirect("/pageerror")


        }
    },


}