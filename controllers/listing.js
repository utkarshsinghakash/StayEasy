const Listing = require("../models/listing");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

module.exports.createListing = async (req, res, next) => {
  //server side validation schema
  console.log(req.body.listing);
  let response = await geocodingClient
    .forwardGeocode({
      query: req.body.listing.location,
      limit: 1,
    })
    .send();

  const newListing = new Listing(req.body.listing);

  console.log(newListing);
  newListing.owner = req.user._id;
  newListing.geometry = response.body.features[0].geometry;
  await newListing.save();
  req.flash("success", "New Listing Created");

  res.redirect(`/listing`);
};
