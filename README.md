# RT Backend - Tourism & Accommodation Management System

A robust RESTful API backend built with **Node.js**, **Express.js**, and **Sequelize ORM** for managing tourism activities, accommodations, bookings, and user operations.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Database](#database)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

**RT Backend** is a comprehensive backend service designed for tourism and accommodation management platforms. It provides APIs for:

- User authentication and management (operators, tourists)
- Activity and tour management
- Accommodation listings
- Booking management for activities and accommodations
- Receipt/invoice generation
- Notification system
- Form handling

---

## ✨ Features

- 🔐 **User Authentication** - JWT-based authentication with bcrypt password hashing
- 👥 **Multi-User Support** - Separate handling for operators and tourists
- 🏠 **Accommodation Management** - CRUD operations for lodging listings
- 🎯 **Activity Management** - Tours and activities with master data
- 📅 **Booking System** - Complete booking workflow for activities and accommodations
- 🧾 **Receipt Generation** - PDF receipt/invoice generation with PDFKit
- 🔔 **Notifications** - In-app notification system
- 📁 **File Uploads** - Image/logo uploads with Multer
- 🔒 **HTTPS Support** - SSL certificate integration ready
- 🌐 **CORS Enabled** - Cross-origin resource sharing configured

---

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express.js** | Web framework |
| **Sequelize** | ORM for MySQL |
| **MySQL** | Database |
| **JWT** | Authentication tokens |
| **bcrypt** | Password hashing |
| **Multer** | File upload handling |
| **PDFKit** | PDF generation |
| **Puppeteer** | Headless browser for PDF rendering |
| **dotenv** | Environment variables |

---

## 📁 Project Structure

```
RT-backend-main/
├── bin/
│   └── www                     # Application entry point
├── config/
│   └── db.js                   # Database configuration (Sequelize)
├── controllers/
│   ├── userController.js       # User operations
│   ├── touristUserController.js # Tourist user operations
│   ├── accomController.js      # Accommodation operations
│   ├── activityController.js   # Activity operations
│   ├── activityMasterDataController.js
│   ├── operatorActivitiesController.js
│   ├── bookingAccommodationController.js
│   ├── bookingActivityController.js
│   ├── formController.js       # Form handling
│   ├── receiptController.js    # Receipt generation
│   └── notificationController.js
├── middleware/
│   └── uploadLogo.js           # File upload middleware
├── migrations/
│   └── *.js                    # Database migrations
├── models/
│   ├── userModel.js            # User schema
│   ├── touristModel.js         # Tourist schema
│   ├── accomModel.js           # Accommodation schema
│   ├── activityModel.js        # Activity schema
│   ├── activityMasterDataModel.js
│   ├── activityMasterTable.js
│   ├── operatorActivitiesModel.js
│   ├── bookingActivityModel.js
│   ├── bookingAccommodationModel.js
│   ├── conversationModel.js
│   ├── formModel.js
│   ├── notificationModel.js
│   └── associations.js         # Model relationships
├── routes/
│   ├── index.js                # Main router
│   ├── userRoutes.js           # /api/users
│   ├── touristUserRoutes.js    # /api/tourists
│   ├── accomRoutes.js          # /api/accom
│   ├── activityRoutes.js       # /api/activity
│   ├── activityMasterDataRoutes.js
│   ├── operatorActivitiesRoutes.js
│   ├── bookingActivityRoutes.js
│   ├── bookingAccommodationRoutes.js
│   ├── formRoutes.js           # /api/form
│   ├── receiptRoutes.js        # /api/receipts
│   └── notificationRoutes.js   # /api/notifications
├── public/
│   └── stylesheets/
│       └── style.css
├── uploads/
│   └── logos/                  # Uploaded files storage
├── ssl/                        # SSL certificates
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
├── package.json                # Dependencies
├── server.js                   # Express app setup
└── README.md                   # This file
```

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 14.x
- **npm** >= 6.x
- **MySQL** >= 5.7 or **MariaDB** >= 10.x
- **Git** (optional, for version control)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd RT-backend-main
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rt_tourism_db
DB_USER=root
DB_PASSWORD=your_password

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:8100

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=24h
```

### 4. Set Up the Database

Create a MySQL database:

```sql
CREATE DATABASE rt_tourism_db;
```

The application uses Sequelize ORM which will automatically sync/create tables on startup.

---

## ⚙️ Configuration

### Database Configuration

Edit `config/db.js` or use environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `3306` |
| `DB_NAME` | Database name | - |
| `DB_USER` | Database username | - |
| `DB_PASSWORD` | Database password | - |

### Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

### CORS Configuration

| Variable | Description |
|----------|-------------|
| `CORS_ORIGIN` | Allowed origin for CORS |
| `CORS_ORIGIN2` | Secondary allowed origin |
| `CORS_ORIGIN_EXTERNAL` | External/production origin |

---

## 🏃 Running the Application

### Development Mode

```bash
npm start
```

Or directly:

```bash
node ./bin/www
```

Or:

```bash
node server.js
```

### The server will start at:

- **HTTP**: `http://localhost:3000`
- **API Base URL**: `http://localhost:3000/api`

### Verify the Server

Test the API endpoint:

```bash
curl http://localhost:3000/api/test
```

Expected response:

```json
{
  "message": "Test route is working"
}
```

---

## 📚 API Endpoints

### Base URL: `/api`

### Authentication & Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users` | Get all users |
| `GET` | `/users/:id` | Get user by ID |
| `POST` | `/users` | Create new user |
| `PUT` | `/users/:id` | Update user |
| `DELETE` | `/users/:id` | Delete user |
| `POST` | `/users/login` | User login |

### Tourist Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tourists` | Get all tourists |
| `POST` | `/tourists` | Create tourist |
| `PUT` | `/tourists/:id` | Update tourist |

### Accommodations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/accom` | Get all accommodations |
| `GET` | `/accom/:id` | Get accommodation by ID |
| `POST` | `/accom` | Create accommodation |
| `PUT` | `/accom/:id` | Update accommodation |
| `DELETE` | `/accom/:id` | Delete accommodation |

### Activities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/activity` | Get all activities |
| `GET` | `/activity/:id` | Get activity by ID |
| `POST` | `/activity` | Create activity |
| `PUT` | `/activity/:id` | Update activity |
| `DELETE` | `/activity/:id` | Delete activity |

### Activity Master Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/activity-master-data` | Get master data |
| `POST` | `/activity-master-data` | Create master data |

### Operator Activities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/operator-activities` | Get operator activities |
| `POST` | `/operator-activities` | Create operator activity |

### Bookings - Activities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/activity-booking` | Get activity bookings |
| `POST` | `/activity-booking` | Create activity booking |
| `PUT` | `/activity-booking/:id` | Update booking |

### Bookings - Accommodations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/accommodation-booking` | Get accommodation bookings |
| `POST` | `/accommodation-booking` | Create booking |
| `PUT` | `/accommodation-booking/:id` | Update booking |

### Receipts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/receipts` | Get all receipts |
| `POST` | `/receipts` | Generate receipt PDF |

### Forms

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/form` | Get forms |
| `POST` | `/form` | Submit form |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/notifications` | Get notifications |
| `POST` | `/notifications` | Create notification |

### Static Files

| Endpoint | Description |
|----------|-------------|
| `/uploads/*` | Uploaded files (logos, images) |

---

## 🗄 Database

### Using Sequelize ORM

This project uses **Sequelize** as the ORM. Models are defined in the `models/` directory.

### Model Associations

Relationships between models are defined in `models/associations.js`.

### Running Migrations

```bash
npx sequelize-cli db:migrate
```

### Database Sync (Development)

The database auto-syncs on application startup. Tables are created automatically based on model definitions.

---

## 📝 Development Notes

### File Uploads

- Files are uploaded to `/uploads/logos/`
- Multer middleware handles multipart form data
- Maximum file size: 10MB (configurable in `server.js`)

### Error Handling

- Async error handling with wrapper function
- HTTP errors created using `http-errors` package

### Logging

- Morgan logger configured for request logging
- Console logging for database connections

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary.

---

## 📞 Support

For support or questions, please contact the development team.

---

**Happy Coding! 🚀**
