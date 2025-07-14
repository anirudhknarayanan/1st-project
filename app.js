const express = require("express")
const app = express()

const path = require("path");
const dotenv = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport");
const middleware = require("./middlewares/auth")
const db = require("./config/db");
const flash = require('connect-flash');

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

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


app.use(middleware.checkUserBlocked);


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
      ne: (a, b) => a != b,
      gt: (a, b) => a > b,
      add: (a, b) => a + b,
      multiply: (a, b) => a * b,
      subtract: (a, b) => a - b,
      range: function (start, end) {
        let arr = [];
        for (let i = start; i <= end; i++) arr.push(i);
        return arr;
      },
      isGreaterThanZero: function (value, options) {
        return Number(value) > 0 ? options.fn(this) : options.inverse(this);
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
      or: function () {
        const args = Array.from(arguments).slice(0, -1); // remove handlebars options object
        return args.some(Boolean);
      },
      formatINR: (value) => {
        if (typeof value !== 'number') value = Number(value);
        return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
      },
      and: function () {
        const args = Array.from(arguments).slice(0, -1);
        return args.every(Boolean);
      },
      formatDate: function (date) {
        if (!date) return '';
        return new Date(date).toLocaleString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }, 
      not: function (value) {
        return !value;
      },
       formatNumber: function (value) {
        if (typeof value !== 'number') value = Number(value);
        return value.toLocaleString('en-IN'); // Adds commas based on Indian numbering system
      },
       dashCase: function (str) {
        if (!str || typeof str !== 'string') return '';
        return str.trim().toLowerCase().replace(/\s+/g, '-');
      },
      formatNumberFixed: function (value) {
        if (isNaN(value)) return '0.00';
        return Number(value).toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },


    }

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