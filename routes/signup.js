const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");

router.get("/signup", (req, res) => {
  res.render("../views/user/signup.ejs");
});

router.post(
  "/signup",
  wrapAsync(async (req, res) => {
    try {
      let { username, email, password } = req.body;
      let newUser = new User({
        email,
        username,
      });

      let registerUser = await User.register(newUser, password);

      req.login(registerUser, (err) => {
        if (err) {
          return next(err);
        }
        req.flash("success", "Welcome to Wanderlust");
        res.redirect("/listing");
      });
    } catch (er) {
      req.flash("error", er.message);
      res.redirect("/signup");
    }
  })
);

router.get("/login", (req, res) => {
  res.render("../views/user/login.ejs");
});

router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  async (req, res) => {
    req.flash("success", "Welcome back to Wanderlust");

    let redirectUrl = res.locals.redirectUrl || "/listing";

    res.redirect(redirectUrl);
  }
);

router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      next(err);
    }
    req.flash("successs", "You are successfully logged out!");
    res.redirect("/listing");
  });
});

module.exports = router;
