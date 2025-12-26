const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const createError = require('http-errors');
const https = require('https');
const fs = require('fs');
const cors = require('cors');

// Import your routes
const userRoutes = require('./routes/userRoutes');
const formRoutes = require('./routes/formRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const accomRoutes = require('./routes/accomRoutes');
const actRoutes = require('./routes/activityRoutes');

require('dotenv').config();

const app = express();

// Define HOST and PORT
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // allow external access

// SSL options
const sslOptions = {
  key: fs.readFileSync('./ssl/key.pem'),
  cert: fs.readFileSync('./ssl/cert.pem')
};

// Enable CORS
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [process.env.CORS_ORIGIN, process.env.CORS_ORIGIN2];
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: false,
};
app.use(cors(corsOptions));

// Middleware
app.use(logger('dev'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cookieParser());

// Serve static files and manifest correctly
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
  }
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/users', userRoutes);
app.use('/api/form', formRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/accom', accomRoutes);
app.use('/api/activity', actRoutes);

// Example POST endpoint
app.post('/api/receipts/void-receipt', (req, res) => {
  console.log(req.body);
  const { receipt_id } = req.body;
  if (!receipt_id) return res.status(400).send({ message: 'receipt_id is required' });
  res.status(200).send({ message: 'Receipt voided successfully' });
});

// Catch 404
app.use((req, res, next) => next(createError(404)));

// Error handler
app.use((err, req, res, next) => {
  console.log(err.stack);
  res.status(err.status || 500).json({
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {},
  });
});

// Start HTTPS server
https.createServer(sslOptions, app).listen(PORT, HOST, () => {
  console.log(`✅ HTTPS server running at https://${HOST}:${PORT}`);
});

module.exports = app;
