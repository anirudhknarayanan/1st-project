const express = require("express")
const app = express()

const path = require("path");
const dotenv = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport");
const middleware = require("./middlewares/auth")
const wishCount = require("./middlewares/wishlistCount")
const db = require("./config/db");
const flash = require('connect-flash');

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

const userRouter = require("./routes/user/index");
const adminRouter = require("./routes/admin/index");

db(); // Connect DB

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 72 * 60 * 60 * 1000, // 72 hours
  },
}));


app.use(middleware.checkUserBlocked);
app.use(wishCount.WishlistCount);


app.use(flash());

// Passport Setup
app.use(passport.initialize());
app.use(passport.session());

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Files
app.use(express.static(path.join(__dirname, "public")));

// View Engine Setup
const exphbs = require("express-handlebars");
const hbsHelpers = require("./helpers/hbsHelpers");

// Register express-handlebars with helpers
app.engine(
  "hbs",
  exphbs.engine({
    extname: "hbs",
    defaultLayout: "layout",
    layoutsDir: path.join(__dirname, "/views/layout/"),
    partialsDir: [
      path.join(__dirname, "/views/partials/admin"),
      path.join(__dirname, "/views/partials/user"),
    ],
    helpers: hbsHelpers
  })
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/", userRouter);
app.use("/admin", adminRouter);


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`server runnin on ${PORT}`);

})
module.exports = app