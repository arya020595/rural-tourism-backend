const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const createError = require("http-errors");
const db = require("./config/db"); // Database configuration
const bodyParser = require("body-parser");
const fs = require("fs");
const https = require("https");

const userRoutes = require("./routes/userRoutes"); // User routes
const formRoutes = require("./routes/formRoutes"); // Form routes
const receiptRoutes = require("./routes/receiptRoutes"); // receipt routes
const accomRoutes = require("./routes/accomRoutes"); // accomodation routes
const actRoutes = require("./routes/activityRoutes"); //activity routes
const touristUserRoutes = require("./routes/touristUserRoutes"); // Tourist User routes
const activityMasterDataRoutes = require("./routes/activityMasterDataRoutes");
const operatorActivityRoutes = require("./routes/operatorActivitiesRoutes");
const bookingActivityRoutes = require("./routes/bookingActivityRoutes");
const bookingAccommodationRoutes = require("./routes/bookingAccommodationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const cors = require("cors"); // Import CORS

const app = express();
require("dotenv").config();
require("./models/associations");

// Enable CORS
console.log(process.env.CORS_ORIGIN);
// optional configuration (security)
// const corsOptions = {
//   // origin: 'http://localhost:8100', // Replace with your Ionic app's URL
//   origin: process.env.CORS_ORIGIN, // Replace with your Ionic app's URL
//   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//   credentials: false, // Allow credentials (if needed)
// };

// const corsOptions = {
//   origin: (origin, callback) => {
//     const allowedOrigins = [
//       process.env.CORS_ORIGIN,
//       process.env.CORS_ORIGIN2,
//       process.env.CORS_ORIGIN_EXTERNAL,
//     ];
//     // Add both your IP and domain
//     if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
//       callback(null, true); // Allow the origin
//     } else {
//       callback(new Error('Not allowed by CORS')); // Reject if not allowed
//     }
//   },
//   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//   credentials: true, // Allow credentials if needed
// };

// ⬇️ Increase limit for JSON and URL-encoded data
app.use(bodyParser.json({ limit: "10mb" })); // or even '50mb' if needed
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: false,
  })
);

// app.use(cors()); // This will allow all origins by default

// Middleware setup
app.use(logger("dev"));
app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "100mb" })); // for JSON payloads
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Serve static files from the 'uploads' folder

// Serve static files (uploads folder) so that the generated PDFs can be accessed
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes setup
app.get("/api/test", (req, res) => {
  console.log(":white_check_mark: Backend /api/test hit");
  res.send({ message: "Test route is working" });
});

app.use("/api/users", userRoutes); // User-related routes
app.use("/api/form", formRoutes); // Form-related routes
app.use("/api/receipts", receiptRoutes); // receipt related routs
app.use("/api/accom", accomRoutes); // accomodation related routes
app.use("/api/activity", actRoutes); // activity related routes
app.use("/api/tourists", touristUserRoutes); // tourist-user related routes
app.use("/api/activity-master-data", activityMasterDataRoutes);
app.use("/api/operator-activities", operatorActivityRoutes);
app.use("/api/activity-booking", bookingActivityRoutes);
app.use("/api/accommodation-booking", bookingAccommodationRoutes);
app.use("/api/notifications", notificationRoutes);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
  // try {

  // } catch (error) {
  console.log(err.stack);
  // }
  res.status(err.status || 500).json({
    message: err.message,
    error: req.app.get("env") === "development" ? err : {},
  });
});

app.post("/api/receipts/void-receipt", (req, res) => {
  // Log the incoming request body to verify it
  console.log(req.body); // This should log { receipt_id: "PE1486813" }

  const { receipt_id } = req.body;

  if (!receipt_id) {
    return res.status(400).send({ message: "receipt_id is required" });
  }

  // Your database logic for voiding the receipt should go here
  // Example query: UPDATE form_responses SET receipt_id = ? WHERE receipt_id = ?

  // If successful, respond with success
  res.status(200).send({ message: "Receipt voided successfully" });
});

// Start the server (remove HOST for running locally)
const PORT = process.env.PORT || 3000;

//uncomment for external host
const HOST = "0.0.0.0"; //for local serve

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});

module.exports = app;
