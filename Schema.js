//joi is used for server side validation so that no one can send unwanted request using postman and hoppscotch

const Joi = require("joi");

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    country: Joi.string().required(),
    price: Joi.number().required().min(0),
    location: Joi.string().required(),
    image: Joi.string().allow(null, ""),

    category: Joi.string()
      .valid(
        "room",
        "iconiccity",
        "beach",
        "mansion",
        "castle",
        "camping",
        "farm"
      )
      .required(),
  }).required(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required(),
});
