const express = require("express")
const app = express()

const path = require("path");
const dotenv = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport");
const db = require("./config/db");


const userRouter = require("./routes/user");
const adminRouter = require("./routes/admin");

db(); // Connect DB



// Session Setup
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
    helpers: {
      eq: (a, b) => a === b,
      lt: (a, b) => a < b,
      gt: (a, b) => a > b,
      add: (a, b) => a + b,
      subtract: (a, b) => a - b,
      range: function (start, end) {
        let arr = [];
        for (let i = start; i <= end; i++) arr.push(i);
        return arr;
      },

      json: function (context) {
        return JSON.stringify(context);
      },
      ifEquals: function (a, b, options) {
        if (typeof options !== 'object' || !options.fn) {
          return a == b || a?.toString() === b?.toString();
        }

        if (a == b || a?.toString() === b?.toString()) {
          return options.fn(this);
        }
        return options.inverse(this);
      },

      ifCond: function (v1, operator, v2, options) {
        v1 = v1?.toString?.();
        v2 = v2?.toString?.();
        switch (operator) {
          case '==': return (v1 == v2) ? options.fn(this) : options.inverse(this);
          case '===': return (v1 === v2) ? options.fn(this) : options.inverse(this);
          case '!=': return (v1 != v2) ? options.fn(this) : options.inverse(this);
          case '!==': return (v1 !== v2) ? options.fn(this) : options.inverse(this);
          case '<': return (v1 < v2) ? options.fn(this) : options.inverse(this);
          case '<=': return (v1 <= v2) ? options.fn(this) : options.inverse(this);
          case '>': return (v1 > v2) ? options.fn(this) : options.inverse(this);
          case '>=': return (v1 >= v2) ? options.fn(this) : options.inverse(this);
          case '&&': return (v1 && v2) ? options.fn(this) : options.inverse(this);
          case '||': return (v1 || v2) ? options.fn(this) : options.inverse(this);
          default: return options.inverse(this);
        }
      },
      formatINR: (value) => {
        if (typeof value !== 'number') value = Number(value);
        return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
      }


    }

  })
);


app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));



// Routes
app.use("/", userRouter);
app.use("/admin", adminRouter);


const PORT = 3000;
app.listen(PORT,()=>{
    console.log(`server runnin on ${PORT}`);
    
})
module.exports = app