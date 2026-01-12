const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const createError = require("http-errors");
const bodyParser = require("body-parser");
const cors = require("cors");

// Load environment variables
require("dotenv").config();

// Database configuration
require("./config/db");
require("./models/associations");

// Route imports
const userRoutes = require("./routes/userRoutes");
const formRoutes = require("./routes/formRoutes");
const receiptRoutes = require("./routes/receiptRoutes");
const accomRoutes = require("./routes/accomRoutes");
const activityRoutes = require("./routes/activityRoutes");
const touristUserRoutes = require("./routes/touristUserRoutes");
const activityMasterDataRoutes = require("./routes/activityMasterDataRoutes");
const operatorActivityRoutes = require("./routes/operatorActivitiesRoutes");
const bookingActivityRoutes = require("./routes/bookingActivityRoutes");
const bookingAccommodationRoutes = require("./routes/bookingAccommodationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const touristBookingsRoutes = require("./routes/touristBookingsRoute");

const app = express();

// CORS Configuration
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? [
          process.env.CORS_ORIGIN,
          process.env.CORS_ORIGIN2,
          process.env.CORS_ORIGIN_EXTERNAL,
        ].filter(Boolean)
      : "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: process.env.NODE_ENV === "production",
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// Middleware setup
app.use(logger("dev"));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes setup
app.get("/api/test", (req, res) => {
  console.log("✅ Backend /api/test hit");
  res.json({
    message: "Test route is working",
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Info endpoint
app.get("/api", (req, res) => {
  res.json({
    name: "RT Backend API",
    version: "1.0.0",
    description:
      "Rural Tourism Backend - Tourism & Accommodation Management System",
    endpoints: {
      users: "/api/users",
      tourists: "/api/tourists",
      accommodations: "/api/accom",
      activities: "/api/activity",
      bookings: {
        activity: "/api/activity-booking",
        accommodation: "/api/accommodation-booking",
      },
      receipts: "/api/receipts",
      notifications: "/api/notifications",
    },
  });
});

app.use("/api/users", userRoutes);
app.use("/api/form", formRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/accom", accomRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/tourists", touristUserRoutes);
app.use("/api/activity-master-data", activityMasterDataRoutes);
app.use("/api/operator-activities", operatorActivityRoutes);
app.use("/api/activity-booking", bookingActivityRoutes);
app.use("/api/accommodation-booking", bookingAccommodationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tourist-bookings", touristBookingsRoutes);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message,
    error: req.app.get("env") === "development" ? err.stack : {},
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// Only start server if this file is run directly (not required by bin/www)
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
