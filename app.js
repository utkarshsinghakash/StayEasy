if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const router = express.Router();
var methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const ExpressError = require("./utils/ExpressError.js");
const connectFlash = require("connect-flash");
const MongoStore = require("connect-mongo");
const list = require("./routes/listing.js");
const review = require("./routes/review.js");
const user = require("./routes/signup.js");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const axios = require("axios");
const bodyParser = require("body-parser");
const wrapAsync = require("./utils/wrapAsync.js");
const Listing = require("./models/listing.js");

app.use(methodOverride("_method"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "/public")));
app.use(express.urlencoded({ extended: true }));
app.engine("ejs", ejsMate);

const AtlasDB = process.env.MONGO_ATLASLINK;

//const Mongo_url = "mongodb://localhost:27017/wanderlust";

main()
  .then(() => {
    console.log("connected to db");
  })
  .catch((er) => {
    console.log(er);
  });

async function main() {
  await mongoose.connect(AtlasDB);
}

app.listen(8080, () => {
  console.log(`app is listening to port 8080`);
});

// app.get("/", (req, res) => {
//   res.redirect("/listing");
// });

const store = MongoStore.create({
  mongoUrl: AtlasDB,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", () => {
  console.log("ERROR in MONGO SESSION STORE", err);
});

app.use(
  session({
    store: store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    },
  })
);

app.use(bodyParser.json());
app.use(connectFlash());

//passport setup
app.use(passport.initialize());
app.use(passport.session()); //to create the session for each person logged in
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  console.log(res.locals.currUser);
  next();
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
});

app.get(
  "/",
  wrapAsync(async (req, res) => {
    let alllisting = await Listing.find({});
    // console.log(alllisting);
    res.render("./views/listing/index.ejs", { alllisting });
  })
);
app.use("/listing", list);
app.use("/listing/:id/review", review);
app.use("/", user);

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page not found!"));
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("./listing/error.ejs", { message });
});
