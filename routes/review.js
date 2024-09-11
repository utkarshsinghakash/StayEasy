const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { reviewSchema } = require("../Schema.js");
const Review = require("../models/review.js");
const Listing = require("../models/listing.js");

const validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(".");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

//review Page
router.post(
  "/",
  validateReview,
  wrapAsync(async (req, res, next) => {
    if (!res.locals.currUser) {
      req.flash("error", "Please login first to create the review");
      return res.redirect("/login");
    }
    const newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    await newReview.save();

    const listing = await Listing.findById(req.params.id);
    listing.reviews.push(newReview);
    await listing.save();
    req.flash("success", "New Review Created");
    res.redirect(`/listing/${req.params.id}`);
  })
);

//delete review
router.delete(
  "/:reviewid",
  wrapAsync(async (req, res) => {
    if (!res.locals.currUser) {
      req.flash("error", "Please login first to delete the review");
      return res.redirect("/login");
    }
    let { id, reviewid } = req.params;

    let reviewauthor = await Review.findById(reviewid);
    if (!reviewauthor.author.equals(res.locals.currUser._id)) {
      req.flash("error", "Only owner of this review can delete this review");
      return res.redirect(`/listing/${id}`);
    }

    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewid } });
    await Review.findByIdAndDelete(reviewid);
    req.flash("success", "Review Deleted");
    res.redirect(`/listing/${id}`);
  })
);

module.exports = router;
