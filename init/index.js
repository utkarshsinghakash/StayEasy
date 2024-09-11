const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const initData = require("./data.js");

const Mongo_url = "mongodb://localhost:27017/wanderlust";

main()
  .then(() => {
    console.log("connected to db");
  })
  .catch((er) => {
    console.log(er);
  });

async function main() {
  await mongoose.connect(Mongo_url);
}

const initDB = async () => {
  await Listing.deleteMany({});
  initData.data = initData.data.map((obj) => ({
    ...obj,
    owner: "66c8cbda288fe992505c8f3b",
  }));
  initData.data = initData.data.map((obj) => ({
    ...obj,
    category: "room",
  }));
  await Listing.insertMany(initData.data);
  console.log("data was initialized");
};

initDB();
