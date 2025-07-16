const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const Wallet = require("../../models/walletSchema");
const nodemailer = require("nodemailer");
const path = require("path")
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
// Import referral helpers
const { getUserReferralCoupons } = require("../../helpers/referralHelpers");
const Referral = require("../../models/referralSchema");
require("dotenv").config();

function generateOtp() {
  const digits = "1234567890";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Your OTP for Password Reset",
      text: `Your OTP is ${otp}`,
      html: `<b><h4>Your OTP is: ${otp}</h4></b>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return true;
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
  getforgotPassword: async (req, res) => {
    try {
      res.render("user/forgot-password", { hideFooter: true });
    } catch (error) {
      console.error("Render forgot-password error:", error);
      res.redirect("/pageNotFound");
    }
  },

  forgotEmailValid: async (req, res) => {
    try {
      const { email } = req.body;
      const findUser = await User.findOne({ email: email });

      if (findUser) {
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
          req.session.userOtp = otp;
          req.session.email = email;
          console.log("Sending OTP to:", email);
          console.log("your otp : ", otp)
          res.render("user/forgotpass-otp", { hideFooter: true });
        } else {
          res.json({ success: false, message: "Failed to send OTP. Try again." });
        }
      } else {
        res.render("user/forgot-password", {
          hideFooter: true,
          message: "User with this email does not exist",
        });
      }
    } catch (error) {
      console.error("Forgot Password Error:", error);
      res.redirect("/pageNotFound");
    }
  },
  verifyForgotPassOtp: async (req, res) => {
    try {
      const enteredOtp = req.body.otp;
      if (enteredOtp === req.session.userOtp) {
        res.json({ success: true, redirectUrl: "/reset-password" })
      } else {
        res.json({ success: false, message: "Otp NOT MATCHING" })
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "An Error occured please try again" })
    }
  },
  getResetPass: async (req, res) => {
    try {
      res.render("user/reset-password")
    } catch (error) {
      res.redirect("/pageNotFound")
    }
  },
  resendOtp: async (req, res) => {
    try {
      const otp = generateOtp()
      req.session.userOtp = otp;
      const email = req.session.email;
      console.log("resending otp to email : ", email);
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        console.log("resend otp", otp);
        res.status(200).json({ success: true, message: "Resent otp successfull" })

      }

    } catch (error) {
      console.error("Error in resending in otp");
      res.status(500).json({ success: false, message: "internal server error" })
    }

  },
  postNewPassword: async (req, res) => {
    try {
      const { newpass1, newpass2 } = req.body;
      console.log(newpass1, newpass2);

      const email = req.session.email;
      if (newpass1 === newpass2) {
        const passwordHash = await securePassword(newpass1)
        await User.updateOne({ email: email }, { $set: { password: passwordHash } })
        res.redirect("/login")
      } else {
        res.render("reset-password", { message: "password do not match" })
      }

    } catch (error) {
      res.redirect("/pageNotFound")
    }
  },

  showProfile: async (req, res) => {
    try {
      const user = req.session.user;

      if (user) {
        const userData = await User.findOne({ _id: user }).lean();
        const addressData = await Address.findOne({ userId: user }).lean();
        const walletData = await Wallet.findOne({ userId: user }).lean() || { transactions: [] };

        console.log("wallet data:", walletData)

        walletData.transactions = walletData.transactions.sort((a, b) => b.createdAt - a.createdAt);



        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const totalOrders = await Order.countDocuments({ user_id: user });
        const totalPages = Math.ceil(totalOrders / limit);


        const orders = await Order.find({ user_id: user })
          .populate("order_items.productId")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        res.render("user/profile", {
          user: userData,
          addressData: addressData || { address: [] },
          orders,
          totalPages,
          currentPage: page,
          wallet: walletData,
        });
      } else {
        res.redirect("/login");
      }
    } catch (error) {
      console.log("Error in showProfile:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  ,
  addAddress: async (req, res) => {
    try {
      const user = req.session.user;
      res.render("user/addAddress")
    } catch (error) {
      res.redirect("/pageerror")
    }

  },
  postAddress: async (req, res) => {
    try {
      const userId = req.session.user;
      const userData = await User.findOne({ _id: userId });
      const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
      const userAddress = await Address.findOne({ userId: userData._id })
      if (!userAddress) {
        const newAddress = new Address({
          userId: userData._id,
          address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]

        })
        await newAddress.save()
      } else {
        userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
        await userAddress.save()
      }
      res.json({ success: true, message: "Address added successfully!" });

    } catch (error) {
      console.error("Error adding address");
      res.status(500).json({ success: false, message: "Something went wrong!" });

    }

  },
  editAddress: async (req, res) => {
    try {
      const addressId = req.params.id;
      const userId = req.session.user;

      const currAddress = await Address.findOne({
        userId: userId,
        "address._id": new mongoose.Types.ObjectId(addressId)
      }).lean();
      console.log("curent adress: ", currAddress);


      if (!currAddress) {
        return res.redirect("/pageNotFound");
      }

      const addressData = currAddress.address.find(item => item._id.toString() === addressId);
      console.log("adressData : ", addressData);


      if (!addressData) {
        return res.redirect("/pageNotFound");
      }

      const user = await User.findById(userId);

      res.render("user/edit-address", {
        address: addressData,
        user: user
      });

    } catch (error) {
      console.error("Error in editAddress:", error);
      res.redirect("/pageNotFound");
    }
  },
  postEditAddress: async (req, res) => {
    try {
      const userId = req.session.user;
      const addressId = req.params.id;
      const updatedData = req.body;

      console.log("Editing address data:", updatedData);

      // Find if the address exists for this user
      const existingAddress = await Address.findOne({
        userId: userId,
        "address._id": addressId,
      });

      if (!existingAddress) {
        return res.redirect("/pageNotFound");
      }

      // Update the specific address inside the address array
      await Address.updateOne(
        { userId: userId, "address._id": addressId },
        {
          $set: {
            "address.$": {
              _id: addressId,
              addressType: updatedData.addressType,
              name: updatedData.name,
              city: updatedData.city,
              landMark: updatedData.landMark,
              state: updatedData.state,
              pincode: updatedData.pincode,
              phone: updatedData.phone,
              altPhone: updatedData.altPhone,
            },
          },
        }
      );

      return res.redirect("/profile");
    } catch (error) {
      console.error("Error while updating address:", error);
      return res.status(500).send("Internal Server Error");
    }
  },

  deleteAddress: async (req, res) => {
    try {
      const addressId = req.params.id;
      const findAddress = await Address.findOne({ "address._id": addressId })
      if (!findAddress) {
        res.status(404).send("address not found");
      }
      await Address.updateOne({
        "address._id": addressId
      }, {
        $pull: {
          address: {
            _id: addressId
          }
        }
      })
      res.redirect("/profile")
    } catch (error) {
      console.error("Error in address deleting")
      res.redirect("pageNotFound")
    }
  },
  changeEmail: async (req, res) => {
    try {
      res.render("user/change-email")
    } catch (error) {
      res.redirect("/pageNotFound")
    }

  },
  postChangeEmail: async (req, res) => {
    try {

      const email = req.body.email;

      const userExist = await User.findOne({ email });
      console.log(userExist);
      if (userExist) {
        res.render("user/newEmail")
      } else {
        res.render("user/change-email", { message: "User with this email not exists" })
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
    }
  },




  verifyEmailOtp: async (req, res) => {
    try {
      const enteredOtp = req.body.otp;
      const sessionOtp = req.session.userOtp;
      const newEmail = req.session.email;
      const userId = req.session.user;

      if (enteredOtp === sessionOtp) {
        // ✅ OTP matches: Update user's email
        await User.findByIdAndUpdate(userId, { email: newEmail });

        // ✅ Clear OTP and temp email from session
        delete req.session.userOtp;
        delete req.session.email;

        // ✅ Send success response with redirect URL
        return res.json({
          success: true,
          message: "Email updated successfully",
          redirectUrl: "/profile"
        });
      } else {
        // ❌ OTP does not match
        return res.json({
          success: false,
          message: "OTP does not match"
        });
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error"
      });
    }
  }
  ,

  resetEmail: async (req, res) => {
    try {


      const newEmail = req.body.newEmail;
      const userId = req.session.user;
      console.log("newEmail : ", newEmail, "userId : ", userId);

      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(newEmail, otp);

      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = newEmail;
        console.log("Email send : ", newEmail);
        console.log("OTP :", otp);
        res.render("user/changeEmail-otp");
      } else {
        res.render("user/newEmail", { message: "new email have problem" })
      }




      // await User.findByIdAndUpdate(userId, { email: newEmail })
      // res.redirect("/profile")
    } catch (error) {
      res.redirect("/pageNotFound")
    }

  },

  updateUserName: async (req, res) => {
    try {
      const userId = req.session.user; // assuming session contains user ID
      const newName = req.body.name;

      console.log("Updating name for user:", userId, "to:", newName);

      if (!newName || newName.trim() === '') {
        return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
      }

      await User.findByIdAndUpdate(userId, { name: newName });

      res.json({ success: true, message: 'Name updated successfully!' });
    } catch (error) {
      console.error("Name update error:", error);
      res.status(500).json({ success: false, message: 'Update failed.' });
    }
  },

  updateUserPhone: async (req, res) => {
    try {
      const userId = req.session.user;
      const newPhone = req.body.phone;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      if (!newPhone || newPhone.trim() === '' || !/^\d{10}$/.test(newPhone)) {
        return res.status(400).json({ success: false, message: 'Enter a valid 10-digit phone number.' });
      }

      await User.findByIdAndUpdate(userId, { phone: newPhone })
      res.json({ success: true, message: 'Phone number updated successfully!' });



    } catch (error) {

      console.error("Phone update error:", error);
      res.status(500).json({ success: false, message: 'Update failed.' });

    }
  },

  getChangePassword: async (req, res) => {
    try {
      res.render("user/changePassword", { hideFooter: true })
    } catch (error) {
      res.redirect("/pageNotFOUND")
    }
  },

  // Referral Details Page
  showReferralDetails: async (req, res) => {
    try {
      const userId = req.session.user;

      if (!userId) {
        return res.redirect("/login");
      }

      // Get user data
      const userData = await User.findById(userId).lean();

      // Get all referral coupons for this user
      const referralCoupons = await getUserReferralCoupons(userId);

      // Get users who used this user's referral code
      const referredUsers = await Referral.find({ referrer: userId })
        .populate('referredUser', 'name email createdOn')
        .sort({ createdAt: -1 })
        .lean();

      // Calculate statistics
      const totalReferrals = referredUsers.length;
      const totalCoupons = referralCoupons.length;
      const usedCoupons = referralCoupons.filter(coupon => coupon.status === 'used').length;
      const unusedCoupons = referralCoupons.filter(coupon => coupon.status === 'unused').length;
      const totalEarnings = totalCoupons * 100; // ₹100 per coupon

      // Debug: Log what we're sending to template
      console.log("🔍 DEBUG - Data being sent to template:");
      console.log("  User:", userData.name, userData.email);
      console.log("  Referral Coupons:", referralCoupons.length);
      referralCoupons.forEach((coupon, i) => {
        console.log(`    Coupon ${i+1}: ${coupon.couponCode}, Status: ${coupon.status}, Discount: ${coupon.discount}`);
      });

      res.render("user/referralDetails", {
        user: userData,
        referralCoupons,
        referredUsers,
        stats: {
          totalReferrals,
          totalCoupons,
          usedCoupons,
          unusedCoupons,
          totalEarnings
        }
      });

    } catch (error) {
      console.error("Error in showReferralDetails:", error);
      res.redirect("/pageNotFound");
    }
  }
  ,
  changePasswordValid: async (req, res) => {
    try {
      console.log(req.body);

      const { email } = req.body;
      const userExist = await User.findOne({ email });
      console.log("existing user", userExist);

      if (userExist) {
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
          req.session.userOtp = otp;
          req.session.userData = req.body;
          req.session.email = email;
          res.render("user/changePassword-otp");
          console.log("Email send to : ",email)
          console.log('OTP has: ', otp);
        } else {
          res.json({ success: false, message: "failed to send otp,please try again" })
        }
      } else {
        res.render("user/changePassword", { message: "user with this email doesnot exist" })
      }

    } catch (error) {
      console.error("Error in change password")
      res.redirect("/pageNotFound")
    }
  },
  verifychangePasswordotp: async (req, res) => {

    try {
      const enteredOtp = req.body.otp;
      if (enteredOtp === req.session.userOtp) {
        res.json({
          success: true,
          redirectUrl: "/reset-password"
        })
      } else {
        res.json({ success: false, message: "error in entered otp" })
      }
    } catch (error) {
      res.json({ success: false, message: "An error occured plz try later" })
    }

  },
  uploadProfileImg: async (req, res) => {
    try {
      const userId = req.session.user; // just the user _id

      if (!userId) {
        console.error("No user session found.");
        return res.redirect("/login");
      }

      if (!req.file || !req.file.filename) {
        console.error("No image file uploaded.");
        return res.status(400).send("No image uploaded.");
      }

      // Construct the relative image path to store in DB
      const imagePath = `/uploads/profile/${req.file.filename}`;

      // Update user image in DB
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { userImage: imagePath } },
        { new: true }
      );

      if (!updatedUser) {
        console.error("User not found.");
        return res.status(404).send("User not found.");
      }

      res.redirect("/profile");
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).send("Image upload failed.");
    }
  }





};
