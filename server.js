const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const createError = require("http-errors");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");

// Load environment variables
require("dotenv").config();

// Database configuration
require("./config/db");
require("./models/associations");

// Scheduler
const bookingReminderScheduler = require("./scripts/bookingReminderScheduler");

// Route imports
const userRoutes = require("./routes/userRoutes");
const formRoutes = require("./routes/formRoutes");
const receiptRoutes = require("./routes/receiptRoutes");
const accomRoutes = require("./routes/accomRoutes");
const activityRoutes = require("./routes/activityRoutes");
const touristUserRoutes = require("./routes/touristUserRoutes");
const activityMasterDataRoutes = require("./routes/activityMasterDataRoutes");
const bookingActivityRoutes = require("./routes/bookingActivityRoutes");
const bookingAccommodationRoutes = require("./routes/bookingAccommodationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const touristBookingsRoutes = require("./routes/touristBookingsRoute");
const operatorBookingsRoutes = require("./routes/operatorBookingsRoute");
const operatorActivitiesRoutes = require("./routes/operatorActivitiesRoutes");
const associationUserRoutes = require("./routes/associationUserRoutes");
const associationRoutes = require("./routes/associationRoutes");
const passwordResetRoutes = require("./routes/passwordResetRoutes");
const authRoutes = require("./routes/authRoutes");
const roleRoutes = require("./routes/roleRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const companyRoutes = require("./routes/companyRoutes");
const productRoutes = require("./routes/productRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const healthRoutes = require("./routes/healthRoutes");

const app = express();

// CORS Configuration
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? [
          process.env.CORS_ORIGIN,
          process.env.CORS_ORIGIN2,
          process.env.CORS_ORIGIN_EXTERNAL,
          process.env.CORS_ORIGIN3,
          "capacitor://localhost", // Capacitor Android APK
          "http://localhost", // Capacitor fallback (cleartext androidScheme)
          "https://localhost", // Capacitor fallback (https androidScheme)
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
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    // Uploaded files (logos, license/certificate PDFs) are served directly to
    // the browser with no auth check. Block content-type sniffing so a file
    // whose declared mimetype doesn't match its actual bytes can't be
    // reinterpreted (e.g. rendered as HTML) by the browser.
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

// Routes setup
app.get("/api/test", (req, res) => {
  console.log("✅ Backend /api/test hit");
  res.json({
    message: "Test route is working",
    timestamp: new Date().toISOString(),
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
      auth: "/api/auth",
      roles: "/api/roles",
      permissions: "/api/permissions",
      tourists: "/api/tourists",
      accommodations: "/api/accom",
      activities: "/api/activity",
      products: "/api/products",
      bookings: {
        activity: "/api/activity-booking",
        accommodation: "/api/accommodation-booking",
        unified: "/api/bookings",
      },
      dashboard: "/api/dashboard",
      receipts: "/api/receipts",
      notifications: "/api/notifications",
      associations: "/api/associations",
      companies: "/api/companies",
      health: "/api/health",
    },
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/form", formRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/accom", accomRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/tourists", touristUserRoutes);
app.use("/api/products", productRoutes);
app.use("/api/activity-master-data", activityMasterDataRoutes);
app.use("/api/activity-booking", bookingActivityRoutes);
app.use("/api/accommodation-booking", bookingAccommodationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tourist-bookings", touristBookingsRoutes);
app.use("/api/operator-bookings", operatorBookingsRoutes);
app.use("/api/operator-activities", operatorActivitiesRoutes);
app.use("/api/association-users", associationUserRoutes);
app.use("/api/associations", associationRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/password", passwordResetRoutes);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "File too large. Each file must be 5MB or smaller.",
    });
  }

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

    if (process.env.NODE_ENV !== "test") {
      bookingReminderScheduler.start();
    }
  });

  process.on("SIGTERM", () => bookingReminderScheduler.stop());
  process.on("SIGINT", () => bookingReminderScheduler.stop());
}

module.exports = app;
