const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
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

const securePassword = async (password)=>{
  try {
    const passwordHash = await bcrypt.hash(password,10)
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
         console.log("your otp : ",otp)
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
  verifyForgotPassOtp : async(req,res)=>{
    try {
      const enteredOtp = req.body.otp;
      if(enteredOtp===req.session.userOtp){
        res.json({success : true,redirectUrl:"/reset-password"})
      }else{
        res.json({success : false,message : "Otp NOT MATCHING"})
      }
    } catch (error) {
      res.status(500).json({success : false,message  : "An Error occured please try again"})
    }
  },
  getResetPass : async (req,res) =>{
    try {
      res.render("user/reset-password")
    } catch (error) {
      res.redirect("/pageNotFound")
    }
  },
  resendOtp : async (req,res)=>{
    try {
      const otp = generateOtp()
      req.session.userOtp = otp;
      const email = req.session.email;
      console.log("resending otp to email : ",email);
      const emailSent = await sendVerificationEmail(email,otp);
      if(emailSent){
        console.log("resend otp",otp);
        res.status(200).json({success : true,message:"Resent otp successfull"})
        
      }
      
    } catch (error) {
      console.error("Error in resending in otp");
      res.status(500).json({success : false,message:"internal server error"})
    }

  },
  postNewPassword : async (req,res)=>{
    try {
      const {newpass1,newpass2} = req.body;
      const email = req.session.email;
      if(newpass1===newpass2){
        const passwordHash = await securePassword(newpass1)
        await User.updateOne({email : email},{$set:{password:passwordHash}})
        res.redirect("/login")
      }else{
        res.render("reset-password",{message : "password do not match"})
      }
      
    } catch (error) {
      res.redirect("/pageNotFound")
    }
  }
};
