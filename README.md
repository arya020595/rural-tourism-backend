# RT Backend - Tourism & Accommodation Management System

A RESTful API backend built with **Node.js**, **Express.js**, and **Sequelize ORM** for managing tourism activities, accommodations, and bookings.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Environment Setup](#environment-setup)
- [Database](#database)
- [API Endpoints](#api-endpoints)
- [Available Scripts](#available-scripts)
- [Tech Stack](#tech-stack)
- [Development Notes](#development-notes)

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.x
- MySQL >= 5.7
- npm

### Installation

```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd rural-tourism-backend
npm install

# 2. Setup environment variables
cp .env.example .env
# Edit .env with your configuration (see Environment Setup below)

# 3. Setup database
npx sequelize-cli db:create
npx sequelize-cli db:migrate

# 4. (Optional) Seed database with sample data
npx sequelize-cli db:seed:all

# 5. Start development server (auto-restarts on file changes)
npm run dev
```

Server will be running at: `http://localhost:3000/api`

> **Tip**: `npm run dev` uses **nodemon** to automatically restart the server whenever you change files in `routes/`, `controllers/`, `models/`, `middleware/`, `config/`, or `utils/`. No manual restart needed during development.

**Test the API:**

```bash
curl http://localhost:3000/api/test
# Expected: {"message": "Test route is working"}

curl http://localhost:3000/api/health
# Expected: {"success": true, "status": "healthy", ...}
```

---

## ⚙️ Environment Setup

Edit your `.env` file with the following configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rural_tourism
DB_USER=root
DB_PASSWORD=your_password

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=http://localhost:8100
CORS_ORIGIN2=http://ruraltourismsabah.com
CORS_ORIGIN_EXTERNAL=http://192.168.1.8:8100
```

### Configuration Variables

| Variable      | Description               | Default/Example       |
| ------------- | ------------------------- | --------------------- |
| `DB_HOST`     | Database host             | `localhost`           |
| `DB_PORT`     | Database port             | `3306`                |
| `DB_NAME`     | Database name             | `rural_tourism`       |
| `DB_USER`     | Database username         | `root`                |
| `DB_PASSWORD` | Database password         | -                     |
| `PORT`        | Server port               | `3000`                |
| `NODE_ENV`    | Environment mode          | `development`         |
| `JWT_SECRET`  | Secret key for JWT tokens | Change in production! |
| `CORS_ORIGIN` | Allowed origins for CORS  | Frontend URL          |

---

## 🗄 Database

### Tables Overview

- **Users**: `rt_users`, `tourist_users`
- **Activities**: `activity_master_table`, `operator_activities`
- **Accommodations**: `accommodation_list`
- **Bookings**: `activity_booking`, `accommodation_booking`
- **Forms & Receipts**: `form_responses`
- **Communications**: `notifications`, `messages`

### Migration Commands

```bash
# Create database
npx sequelize-cli db:create

# Run all migrations
npx sequelize-cli db:migrate

# Rollback last migration
npx sequelize-cli db:migrate:undo

# Fresh setup (drop, create, and migrate)
npx sequelize-cli db:drop && npx sequelize-cli db:create && npx sequelize-cli db:migrate

# Create new migration
npx sequelize-cli migration:generate --name your-migration-name
```

### Seeder Commands

```bash
# Run all seeders (populate database with sample data)
npx sequelize-cli db:seed:all

# Undo all seeders (remove sample data)
npx sequelize-cli db:seed:undo:all

# Fresh setup with sample data
npx sequelize-cli db:drop && npx sequelize-cli db:create && npx sequelize-cli db:migrate && npx sequelize-cli db:seed:all
```

**Sample Data Includes:**

- 3 operators and 4 tourists (password: `password123`)
- 5 activities and 4 accommodations
- Sample bookings, receipts, notifications, and messages

> **Note**: Model relationships are defined in `models/associations.js`

---

## 📚 API Endpoints

**Base URL**: `/api`

| Resource                  | Endpoints                                         |
| ------------------------- | ------------------------------------------------- |
| **Test / Health**         | GET `/test`, GET `/health`, GET `/`               |
| **Users**                 | GET/POST/PUT/DELETE `/users`, POST `/users/login` |
| **Tourists**              | GET/POST/PUT `/tourists`, POST `/tourists/login`  |
| **Accommodations**        | GET/POST/PUT/DELETE `/accom`                      |
| **Activities**            | GET/POST/PUT/DELETE `/activity`                   |
| **Activity Master Data**  | GET/POST `/activity-master-data`                  |
| **Operator Activities**   | GET/POST `/operator-activities`                   |
| **Activity Bookings**     | GET/POST/PUT `/activity-booking`                  |
| **Accommodation Booking** | GET/POST/PUT `/accommodation-booking`             |
| **Tourist Bookings**      | GET `/tourist-bookings`                           |
| **Operator Bookings**     | GET `/operator-bookings`                          |
| **Receipts**              | GET/POST `/receipts`                              |
| **Forms**                 | GET/POST `/form`                                  |
| **Notifications**         | GET/POST `/notifications`                         |
| **Uploads**               | Static files at `/uploads/*`                      |

---

## 🔧 Available Scripts

| Command                    | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `npm run dev`              | Start dev server with **nodemon** (auto-restart) |
| `npm start`                | Start production server                          |
| `npm run server`           | Start server directly with `node server.js`      |
| `npm run console`          | Open interactive REPL with models loaded         |
| `npm run db:sync`          | Sync database schema from models                 |
| `npm test`                 | Run all tests with coverage                      |
| `npm run test:watch`       | Run tests in watch mode                          |
| `npm run test:unit`        | Run unit tests only                              |
| `npm run test:integration` | Run integration tests only                       |
| `npm run lint`             | Lint the codebase                                |

---

## 🛠 Tech Stack

| Category       | Technology                  |
| -------------- | --------------------------- |
| Runtime        | Node.js >= 18               |
| Framework      | Express.js 4.x              |
| ORM            | Sequelize 6.x + MySQL2      |
| Authentication | JWT (jsonwebtoken) + bcrypt |
| File Uploads   | Multer                      |
| PDF Generation | PDFKit + Puppeteer          |
| Testing        | Jest + Supertest            |
| Dev Server     | Nodemon (auto-restart)      |
| Logging        | Morgan                      |

---

## 📝 Development Notes

- **Auto-restart**: Use `npm run dev` — nodemon watches `routes/`, `controllers/`, `models/`, `middleware/`, `config/`, `utils/`, and `server.js` for changes
- **File uploads**: Stored in `/uploads/logos/`, max 10MB (configured via body-parser)
- **CORS**: Opens to all origins in development; restricted in production via env vars
- **Error handling**: Using `http-errors` package with stack traces in development mode
- **Logging**: Morgan for HTTP requests, console for database operations
- **Model relationships**: Defined in `models/associations.js`
- **Request size limit**: 10MB for JSON and URL-encoded bodies

---

**License**: Private and proprietary
