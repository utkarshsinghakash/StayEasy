const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("../Schema.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");

const Razorpay = require("razorpay");

const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Review = require("../models/review.js");
require("dotenv").config();
const axios = require("axios");

const listingController = require("../controllers/listing.js");

const validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(".");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

//index route
router.get(
  "/",
  wrapAsync(async (req, res) => {
    let alllisting = await Listing.find({});
    // console.log(alllisting);
    res.render("./listing/index.ejs", { alllisting });
  })
);

//filter
router.get("/category/:category", async (req, res) => {
  let { category } = req.params;
  let alllisting = await Listing.find({ category: category });

  res.render("./listing/filters.ejs", { alllisting });
});

//search
router.post("/place/search", async (req, res) => {
  let location = req.body.location;
  console.log(location);

  let alllisting = await Listing.find({ location: location });
  console.log(alllisting);

  res.render("./listing/index.ejs", { alllisting });
});

//new user
router.get("/new", (req, res) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "you must be logged in to create listing!");
    return res.redirect("/login");
  }
  res.render("./listing/new.ejs");
});

//booking route
// router.get('booking/payment', (req, res) => {
//   const backendURL = process.env.NODE_ENV === 'production'
//     ? 'https://your-production-url.com/listing/booking/verify-payment'
//     : 'http://localhost:8080/listing/booking/verify-payment';

//   res.render('payment', { backendURL });
// });

router.post("/booking/payment", async (req, res) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "you must be logged in to book listing!");
    delete req.session.redirectUrl;
    return res.redirect("/login");
  }
  let bookingInfo = req.body;
  req.session.day = bookingInfo.day;
  const userId = req.user._id;
  req.session.userId = userId;
  let user = await User.findById(userId);

  const backendURL =
    process.env.NODE_ENV === "production"
      ? "https://stayeasy-xbel.onrender.com/listing/booking/verify-payment"
      : "http://localhost:8080/listing/booking/verify-payment";

  const listing = await Listing.findById(req.session.listingId);
  const razorpayId = process.env.RAZORPAY_ID_KEY;
  res.render("./listing/payment.ejs", {
    listing,
    bookingInfo,
    user,
    razorpayId,
    backendURL,
  });
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_ID_KEY,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

//verify-payment
router.get("/booking/verify-payment", async (req, res) => {
  try {
    let id = req.session.listingId;
    let userId = req.session.userId;
    let listing = await Listing.findById(id);
    let user = await User.findById(userId);

    const options = {
      amount: listing.price * 100, // Amount in paise
      currency: "INR",
    };

    // Create an order with Razorpay
    const order = await razorpay.orders.create(options);
    res.status(200).json({ orderId: order.id }); // Set status to 200 OK
  } catch (error) {
    console.error("Error creating Razorpay order:", error); // Log error for debugging
    res.status(500).json({ error: "Failed to create order" }); // Provide a generic error message
  }
});

router.post("/booking/verify-payment", async (req, res) => {
  const payment_id = req.body.razorpay_payment_id;

  try {
    const payment = await razorpay.payments.fetch(payment_id);

    if (payment.status === "authorized") {
      // Capture payment
      await razorpay.payments.capture(payment_id, payment.amount);

      res
        .status(200)
        .json({ success: true, message: "Payment captured successfully" });

      let id = req.session.listingId;
      let userId = req.session.userId;
      let listing = await Listing.findById(id);
      let user = await User.findById(userId);

      console.log(user);
      console.log(listing);

      // Additional logic to handle receipt generation and email can be added here.
      const pdfDoc = new PDFDocument();
      const pdfPath = path.join(
        __dirname,
        `../booking/booking_${payment_id}.pdf`
      );
      pdfDoc.pipe(fs.createWriteStream(pdfPath));

      pdfDoc.fontSize(20).text("Booking Confirmation", { align: "center" });
      pdfDoc.moveDown();
      pdfDoc.fontSize(14).text(`Listing: ${listing.title}`);
      pdfDoc.text(`Price of 1 night: ₹${listing.price}`);
      pdfDoc.text(`No of days staying: ${req.session.day} day(s)`);
      pdfDoc.text(
        `Total Amount after taxes: ₹${
          listing.price * req.session.day +
          listing.price * req.session.day * 0.18
        }`
      );

      pdfDoc.end();
      const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        auth: {
          user: process.env.EMAIL_USER, // your email
          pass: process.env.EMAIL_PASS, // your email password
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Booking Confirmation",
        text: `Dear ${user.username},\n\nYour booking is confirmed at ${listing.title}! Please find the attached PDF for booking details.\n\nThanks,\nStayEasy`,
        attachments: [
          {
            filename: `booking_${payment_id}.pdf`,
            path: pdfPath,
          },
        ],
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
          res.status(500).json({
            success: false,
            message: "Payment captured but failed to send email.",
          });
        } else {
          console.log("Email sent: " + info.response);
          res.status(200).json({
            success: true,
            message: "Payment captured successfully and email sent!",
          });
        }
      });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Payment verification failed!" });
    }
  } catch (error) {
    console.error("Error capturing payment:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while verifying payment!",
    });
  }
});

//show route
router.get(
  "/:id",
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let myListing = await Listing.findById(id)
      .populate({ path: "reviews", populate: { path: "author" } })
      .populate("owner");
    if (!myListing) {
      req.flash("error", "This Listing Does not exist");
      res.redirect("/listing");
    }
    req.session.listingId = id;

    res.render("./listing/show.ejs", { myListing });
  })
);

//Create Route
router.post("/", validateListing, wrapAsync(listingController.createListing));

// router.post("/", upload.single("listing[image]"), async (req, res) => {
//   try {
//     const result = await uploadToCloudinary(req.file, "listings");
//     res.send(result); // Send the Cloudinary result or some response back to the client
//   } catch (err) {
//     res.status(500).send("An error occurred while uploading the image");
//   }
//});
// let {
//   title: title,
//   description: description,
//   image: image,
//   price: price,
//   location: location,
//   country: country,
// } = req.body;

// await Listing.insertMany([
//   {
//     title: title,
//     description: description,
//     image: image,
//     price: price,
//     location: location,
//     country: country,
//   },
// ]);
//res.redirect("/listing");

//edit route
router.get(
  "/:id/edit",
  wrapAsync(async (req, res) => {
    if (!req.isAuthenticated()) {
      req.session.redirectUrl = req.originalUrl;
      req.flash("error", "you must be logged in to create listing!");
      return res.redirect("/login");
    }
    let { id } = req.params;
    let thislisting = await Listing.findById(id);
    if (!thislisting.owner._id.equals(res.locals.currUser._id)) {
      req.flash("error", "Only owner this listing can update or delete");
      return res.redirect(`/listing/${id}`);
    }

    if (!thislisting) {
      req.flash("error", "This Listing Does not exist");
      res.redirect("/listing");
    }
    res.render("./listing/edit.ejs", { thislisting });
  })
);

//update route
router.patch(
  "/:id",
  wrapAsync(async (req, res) => {
    if (!req.isAuthenticated()) {
      req.session.redirectUrl = req.originalUrl;
      req.flash("error", "you must be logged in to create listing!");
      return res.redirect("/login");
    }
    let {
      title: newtitle,
      description: newdescription,
      image: newimage,
      price: newprice,
      location: newlocation,
      country: newcountry,
    } = req.body;

    let { id } = req.params;
    let thislisting = await Listing.findById(id);
    if (!thislisting.owner._id.equals(res.locals.currUser._id)) {
      req.flash("error", "Only owner this listing can update or delete");
      return res.redirect(`/listing/${id}`);
    }
    await Listing.findByIdAndUpdate(id, {
      title: newtitle,
      description: newdescription,
      image: newimage,
      price: newprice,
      location: newlocation,
      country: newcountry,
    });
    req.flash("success", "Listing Updated");
    res.redirect(`/listing/${id}`);
  })
);

//delete route
router.delete(
  "/:id",
  wrapAsync(async (req, res) => {
    if (!req.isAuthenticated()) {
      req.flash("error", "you must be logged in to create listing!");
      return res.redirect("/login");
    }
    let { id } = req.params;
    let thislisting = await Listing.findById(id);
    if (!thislisting.owner._id.equals(res.locals.currUser._id)) {
      req.flash("error", "Only owner this listing can update or delete");
      return res.redirect(`/listing/${id}`);
    }
    await Listing.findByIdAndDelete(id, {});
    req.flash("success", "Listing Deleted");
    res.redirect("/listing");
  })
);

module.exports = router;
