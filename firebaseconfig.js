const admin = require("firebase-admin");
const serviceAccount = require("./config/firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "wanderlust-3b9b8.appspot.com",
});

const bucket = admin.storage().bucket();

module.exports = bucket;
