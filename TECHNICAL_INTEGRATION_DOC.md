# Technical Integration Documentation

## Complaint & Emergency Ticketing System

### Botpress × WhatsApp × Ruby on Rails

| Field                | Value                            |
| -------------------- | -------------------------------- |
| **Document Version** | 1.0.0                            |
| **Date**             | 2026-03-03                       |
| **Status**           | Implementation-Ready             |
| **Authors**          | Solutions Architecture Team      |
| **Audience**         | Engineering, DevOps, QA, Product |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Data Flow Diagram](#3-data-flow-diagram)
4. [API Specification](#4-api-specification)
5. [Database Design](#5-database-design)
6. [Ticket Status Flow](#6-ticket-status-flow)
7. [Botpress Flow Design](#7-botpress-flow-design)
8. [Automation](#8-automation)
9. [Security Design](#9-security-design)
10. [Dashboard Requirements](#10-dashboard-requirements)
11. [Future Scalability](#11-future-scalability)
12. [Example Rails Controller Code](#12-example-rails-controller-code)
13. [Example Botpress Webhook Configuration](#13-example-botpress-webhook-configuration)
14. [Appendices](#14-appendices)

---

## 1. System Overview

### 1.1 Purpose

This document defines the technical integration between a **Botpress-powered WhatsApp chatbot** and a **Ruby on Rails backend** to deliver a CRM-style **Ticketing & Complaint Management Platform**. The system enables citizens and tourists to submit complaints, emergency reports, and general inquiries via WhatsApp. Tickets are routed to the appropriate government ministry or department, managed by Customer Service agents through an admin dashboard, and tracked by end-users through the chatbot or a web/mobile application.

### 1.2 Stakeholders

| Role                       | Responsibility                                               |
| -------------------------- | ------------------------------------------------------------ |
| End User (Tourist/Citizen) | Submits complaints, checks ticket status via WhatsApp or app |
| Customer Service (CS)      | Triages, updates, and resolves tickets via admin dashboard   |
| Ministry / Department      | Receives escalated tickets, provides resolution              |
| Admin                      | Manages system configuration, users, SLA rules               |
| Engineering Team           | Builds and maintains all system components                   |

### 1.3 Technology Stack

| Layer           | Technology                                                    |
| --------------- | ------------------------------------------------------------- |
| Chatbot Engine  | Botpress (Cloud or Self-Hosted)                               |
| Channel         | WhatsApp (via Botpress WhatsApp Integration / Meta Cloud API) |
| Backend API     | Ruby on Rails 7.x (API mode)                                  |
| Database        | PostgreSQL 15+                                                |
| Background Jobs | Sidekiq + Redis                                               |
| File Storage    | AWS S3 / MinIO (S3-compatible)                                |
| Email           | Action Mailer (SMTP / SES)                                    |
| Auth            | Devise + JWT (devise-jwt)                                     |
| Admin Dashboard | React / Next.js (or Rails View)                               |
| Monitoring      | Sentry, Prometheus + Grafana                                  |
| CI/CD           | GitHub Actions                                                |

### 1.4 Existing Chatbot Capabilities

The Botpress chatbot already supports the following conversational features:

- **Contact Directory** — Emergency numbers, complaint hotlines, consulate contacts
- **Destination & Attraction Suggestions** — NLU-driven recommendations
- **Transportation Info** — Routes, distances, bus/flight/rental car details
- **Brochures** — PDF download links
- **Public Holidays & Events** — External link redirection
- **Activities List** — Curated activity suggestions
- **NLU Engine** — Intent detection, entity extraction, context management
- **Human Agent Handover** — Transfer to live agent during working hours (configurable schedule)

The **new feature** documented herein extends the chatbot with structured complaint and emergency ticket creation, status tracking, and full backend integration.

---

## 2. High-Level Architecture

### 2.1 Architecture Diagram (Textual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          END USERS                                  │
│                                                                     │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐     │
│   │  WhatsApp     │    │  Web App      │    │  Mobile App       │   │
│   │  (User Chat)  │    │  (Status UI)  │    │  (Status UI)      │   │
│   └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘     │
└──────────┼───────────────────┼──────────────────────┼───────────────┘
           │                   │                      │
           ▼                   │                      │
┌──────────────────┐           │                      │
│  Meta Cloud API  │           │                      │
│  (WhatsApp Bus.) │           │                      │
└────────┬─────────┘           │                      │
         │ Webhook             │                      │
         ▼                     │                      │
┌──────────────────┐           │                      │
│    BOTPRESS       │           │                      │
│  ┌─────────────┐ │           │                      │
│  │ NLU Engine  │ │           │                      │
│  ├─────────────┤ │           │                      │
│  │ Flow Engine │ │           │                      │
│  ├─────────────┤ │           │                      │
│  │ Webhook     │ │           │                      │
│  │ (HTTP Call) │──┼───────┐  │                      │
│  └─────────────┘ │       │  │                      │
└──────────────────┘       │  │                      │
                           ▼  ▼                      ▼
                   ┌──────────────────────────────────────┐
                   │        RUBY ON RAILS API              │
                   │        (api.example.com)               │
                   │                                        │
                   │  ┌────────────┐  ┌─────────────────┐  │
                   │  │ Tickets    │  │ Authentication  │  │
                   │  │ Controller │  │ (JWT / API Key) │  │
                   │  ├────────────┤  ├─────────────────┤  │
                   │  │ Users      │  │ Rate Limiter    │  │
                   │  │ Controller │  │ (Rack::Attack)  │  │
                   │  ├────────────┤  ├─────────────────┤  │
                   │  │ Attachments│  │ File Upload     │  │
                   │  │ Controller │  │ (ActiveStorage) │  │
                   │  └────────────┘  └─────────────────┘  │
                   │                                        │
                   │  ┌────────────────────────────────┐    │
                   │  │     SIDEKIQ (Background Jobs)  │    │
                   │  │  - Email dispatch              │    │
                   │  │  - SLA monitoring              │    │
                   │  │  - Escalation rules            │    │
                   │  │  - Webhook retries             │    │
                   │  └──────────────┬─────────────────┘    │
                   └─────────┬───────┼──────────────────────┘
                             │       │
                    ┌────────▼──┐  ┌─▼──────────┐  ┌──────────────┐
                    │PostgreSQL │  │   Redis     │  │  AWS S3      │
                    │  Database │  │  (Sidekiq)  │  │  (Files)     │
                    └───────────┘  └────────────┘  └──────────────┘
                             │
                    ┌────────▼──────────────┐
                    │   ADMIN DASHBOARD      │
                    │   (CS / Admin / Min.)  │
                    │   - Ticket Management  │
                    │   - SLA Monitoring     │
                    │   - Reporting          │
                    └───────────────────────┘
```

### 2.2 Component Responsibilities

| Component               | Role                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| **WhatsApp / Meta API** | Message transport layer between user device and Botpress             |
| **Botpress**            | Conversational AI — intent detection, data collection, webhook calls |
| **Rails API**           | Core business logic — ticket CRUD, auth, file management, automation |
| **PostgreSQL**          | Persistent data store — users, tickets, messages, attachments        |
| **Sidekiq + Redis**     | Async job processing — emails, SLA checks, escalation                |
| **AWS S3**              | Object storage for uploaded images and documents                     |
| **Admin Dashboard**     | Web UI for CS agents, administrators, and ministry users             |

---

## 3. Data Flow Diagram

### 3.1 Ticket Creation Flow

```
Step  Actor          Action
────  ─────          ──────
 1    User           Sends "I want to make a complaint" via WhatsApp
 2    Meta API       Forwards message payload to Botpress webhook
 3    Botpress NLU   Detects intent: complaint_create
 4    Botpress Flow  Initiates structured data collection:
                       → Asks: Category (Emergency / Complaint / Others)
                       → Asks: Description (free text)
                       → Asks: Image upload (optional, max 5)
                       → Asks: Location (GPS pin via WhatsApp location share)
                       → Asks: Contact details (name, phone, email optional)
 5    Botpress       Validates collected data
 6    Botpress       Sends POST /api/v1/tickets to Rails API
                       Headers: { Authorization: Bearer <bot_api_key> }
                       Body:    { ticket data + base64 images + GPS coords }
 7    Rails API      Authenticates request via API key
 8    Rails API      Validates payload (strong params + JSON schema)
 9    Rails API      Creates ticket record in PostgreSQL
10    Rails API      Uploads images to S3 via ActiveStorage
11    Rails API      Enqueues Sidekiq jobs:
                       → TicketNotificationJob (email to ministry)
                       → SlaTimerJob (start SLA clock)
12    Rails API      Returns response:
                       { ticket_id: "TKT-20260303-0001", status: "open" }
13    Botpress       Displays confirmation to user:
                       "Your ticket TKT-20260303-0001 has been created.
                        We will update you on the progress."
14    Sidekiq        Sends email notification to assigned ministry/department
15    CS Agent       Sees new ticket in admin dashboard
```

### 3.2 Ticket Status Check Flow

```
Step  Actor          Action
────  ─────          ──────
 1    User           Sends "Check my ticket status" or "TKT-20260303-0001"
 2    Botpress NLU   Detects intent: ticket_status_check
 3    Botpress Flow  Extracts ticket ID from message or asks user for it
 4    Botpress       Sends GET /api/v1/tickets/:id to Rails API
 5    Rails API      Looks up ticket, verifies user association
 6    Rails API      Returns ticket status + last update
 7    Botpress       Displays:
                       "Ticket TKT-20260303-0001
                        Status: In Progress
                        Last Update: Being reviewed by Ministry of Tourism
                        Updated: 2026-03-02 14:30 UTC"
```

### 3.3 Ticket Update Flow (CS Agent)

```
Step  Actor          Action
────  ─────          ──────
 1    CS Agent       Opens ticket in admin dashboard
 2    CS Agent       Updates status from "Open" → "In Progress"
 3    Dashboard      Sends PATCH /api/v1/tickets/:id
 4    Rails API      Updates ticket, creates ticket_message log
 5    Rails API      Enqueues notification job (WhatsApp push via Botpress API)
 6    Sidekiq        Sends proactive WhatsApp message to user via Botpress
 7    User           Receives status update on WhatsApp
```

---

## 4. API Specification

### 4.1 Base Configuration

| Property         | Value                                                |
| ---------------- | ---------------------------------------------------- |
| **Base URL**     | `https://api.example.com/api/v1`                     |
| **Content-Type** | `application/json`                                   |
| **Auth Method**  | API Key (for Botpress) / JWT (for Users & Dashboard) |
| **API Version**  | v1                                                   |
| **Rate Limit**   | 100 req/min (Botpress), 60 req/min (User)            |

### 4.2 Authentication

#### 4.2.1 Botpress → Rails (API Key)

All requests from Botpress include a static API key in the `Authorization` header:

```http
Authorization: Bearer bp_live_abc123def456ghi789
X-Bot-Signature: HMAC-SHA256 signature of request body
```

The API key is stored as an environment variable on both Botpress and Rails:

```ruby
# Rails: config/credentials.yml.enc
botpress:
  api_key: bp_live_abc123def456ghi789
  hmac_secret: your_hmac_secret_key_here
```

#### 4.2.2 User → Rails (JWT)

Users authenticate via login (WhatsApp phone number or email/password) and receive a JWT token:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

JWT payload:

```json
{
  "sub": 42,
  "role": "user",
  "phone": "+6281234567890",
  "exp": 1741219200,
  "jti": "unique-token-id"
}
```

#### 4.2.3 Dashboard → Rails (JWT with Role)

Dashboard users (CS/Admin/Ministry) authenticate similarly but carry a role claim:

```json
{
  "sub": 10,
  "role": "cs_agent",
  "permissions": ["tickets:read", "tickets:update"],
  "exp": 1741219200
}
```

---

### 4.3 Endpoints

#### 4.3.1 `POST /api/v1/tickets` — Create Ticket

**Called by:** Botpress (after data collection)

**Request:**

```http
POST /api/v1/tickets HTTP/1.1
Host: api.example.com
Authorization: Bearer bp_live_abc123def456ghi789
X-Bot-Signature: <HMAC-SHA256>
Content-Type: application/json
```

**Request Body Schema:**

```json
{
  "ticket": {
    "category": "emergency",
    "description": "There is a fallen tree blocking the road near the main tourist area.",
    "priority": "high",
    "location": {
      "latitude": -8.409518,
      "longitude": 115.188919,
      "address": "Jl. Raya Ubud, Gianyar, Bali"
    },
    "contact": {
      "name": "John Doe",
      "phone": "+6281234567890",
      "email": "john@example.com",
      "whatsapp_id": "6281234567890@s.whatsapp.net"
    },
    "attachments": [
      {
        "filename": "photo_001.jpg",
        "content_type": "image/jpeg",
        "data": "<base64_encoded_image_data>"
      },
      {
        "filename": "photo_002.jpg",
        "content_type": "image/jpeg",
        "data": "<base64_encoded_image_data>"
      }
    ],
    "metadata": {
      "botpress_conversation_id": "conv_abc123",
      "source_channel": "whatsapp",
      "locale": "en",
      "submitted_at": "2026-03-03T10:30:00Z"
    }
  }
}
```

**Request Body Field Definitions:**

| Field                                      | Type   | Required | Validation                                                                       |
| ------------------------------------------ | ------ | -------- | -------------------------------------------------------------------------------- |
| `ticket.category`                          | string | Yes      | Enum: `emergency`, `complaint`, `others`                                         |
| `ticket.description`                       | string | Yes      | Min: 10 chars, Max: 5000 chars                                                   |
| `ticket.priority`                          | string | No       | Enum: `low`, `medium`, `high`, `critical`. Auto-derived from category if omitted |
| `ticket.location.latitude`                 | float  | No       | Range: -90 to 90                                                                 |
| `ticket.location.longitude`                | float  | No       | Range: -180 to 180                                                               |
| `ticket.location.address`                  | string | No       | Max: 500 chars                                                                   |
| `ticket.contact.name`                      | string | Yes      | Max: 255 chars                                                                   |
| `ticket.contact.phone`                     | string | Yes      | E.164 format (`+[country][number]`)                                              |
| `ticket.contact.email`                     | string | No       | Valid email format                                                               |
| `ticket.contact.whatsapp_id`               | string | Yes      | WhatsApp JID format                                                              |
| `ticket.attachments[]`                     | array  | No       | Max 5 items                                                                      |
| `ticket.attachments[].filename`            | string | Yes\*    | Alphanumeric + extension                                                         |
| `ticket.attachments[].content_type`        | string | Yes\*    | Allowed: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`              |
| `ticket.attachments[].data`                | string | Yes\*    | Base64 encoded, max 10 MB per file                                               |
| `ticket.metadata.botpress_conversation_id` | string | Yes      | Botpress conversation reference                                                  |
| `ticket.metadata.source_channel`           | string | Yes      | Enum: `whatsapp`, `web`, `mobile`                                                |

**Success Response: `201 Created`**

```json
{
  "data": {
    "id": 1042,
    "ticket_number": "TKT-20260303-0001",
    "status": "open",
    "category": "emergency",
    "priority": "high",
    "description": "There is a fallen tree blocking the road near the main tourist area.",
    "location": {
      "latitude": -8.409518,
      "longitude": 115.188919,
      "address": "Jl. Raya Ubud, Gianyar, Bali"
    },
    "contact": {
      "name": "John Doe",
      "phone": "+6281234567890"
    },
    "attachments": [
      {
        "id": 201,
        "filename": "photo_001.jpg",
        "url": "https://s3.amazonaws.com/bucket/tickets/1042/photo_001.jpg",
        "content_type": "image/jpeg"
      }
    ],
    "assigned_department": "Ministry of Public Works",
    "sla_deadline": "2026-03-03T14:30:00Z",
    "created_at": "2026-03-03T10:30:00Z",
    "updated_at": "2026-03-03T10:30:00Z"
  },
  "meta": {
    "message": "Ticket created successfully",
    "sla_hours": 4
  }
}
```

**Error Responses:**

| Status | Code                    | Description                   |
| ------ | ----------------------- | ----------------------------- |
| `400`  | `validation_error`      | Missing/invalid fields        |
| `401`  | `unauthorized`          | Invalid or missing API key    |
| `413`  | `payload_too_large`     | Attachment exceeds size limit |
| `422`  | `unprocessable_entity`  | Semantically invalid data     |
| `429`  | `rate_limited`          | Too many requests             |
| `500`  | `internal_server_error` | Unexpected server error       |

**Error Response Body:**

```json
{
  "error": {
    "code": "validation_error",
    "message": "Validation failed",
    "details": [
      {
        "field": "ticket.description",
        "message": "must be at least 10 characters",
        "code": "too_short"
      },
      {
        "field": "ticket.contact.phone",
        "message": "must be in E.164 format",
        "code": "invalid_format"
      }
    ]
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-03-03T10:30:00Z"
  }
}
```

---

#### 4.3.2 `GET /api/v1/tickets/:id` — Retrieve Ticket

**Called by:** Botpress (status check), Dashboard, Mobile/Web App

**Request:**

```http
GET /api/v1/tickets/TKT-20260303-0001 HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
```

> **Note:** The `:id` parameter accepts both numeric IDs and ticket numbers (`TKT-YYYYMMDD-XXXX`).

**Query Parameters:**

| Parameter | Type   | Default | Description                                           |
| --------- | ------ | ------- | ----------------------------------------------------- |
| `include` | string | —       | Comma-separated: `messages`, `attachments`, `history` |

**Example with includes:**

```http
GET /api/v1/tickets/TKT-20260303-0001?include=messages,attachments HTTP/1.1
```

**Success Response: `200 OK`**

```json
{
  "data": {
    "id": 1042,
    "ticket_number": "TKT-20260303-0001",
    "status": "in_progress",
    "category": "emergency",
    "priority": "high",
    "description": "There is a fallen tree blocking the road near the main tourist area.",
    "location": {
      "latitude": -8.409518,
      "longitude": 115.188919,
      "address": "Jl. Raya Ubud, Gianyar, Bali"
    },
    "contact": {
      "name": "John Doe",
      "phone": "+6281234567890"
    },
    "assigned_to": {
      "id": 5,
      "name": "Agent Sarah",
      "role": "cs_agent"
    },
    "assigned_department": "Ministry of Public Works",
    "sla_deadline": "2026-03-03T14:30:00Z",
    "sla_breached": false,
    "attachments": [
      {
        "id": 201,
        "filename": "photo_001.jpg",
        "url": "https://s3.amazonaws.com/bucket/tickets/1042/photo_001.jpg",
        "content_type": "image/jpeg",
        "size_bytes": 245760
      }
    ],
    "messages": [
      {
        "id": 301,
        "author_type": "system",
        "author_name": "System",
        "body": "Ticket created via WhatsApp chatbot",
        "created_at": "2026-03-03T10:30:00Z"
      },
      {
        "id": 302,
        "author_type": "cs_agent",
        "author_name": "Agent Sarah",
        "body": "We have dispatched a team to the location. ETA 30 minutes.",
        "created_at": "2026-03-03T11:00:00Z"
      }
    ],
    "status_history": [
      {
        "from": null,
        "to": "open",
        "changed_by": "system",
        "changed_at": "2026-03-03T10:30:00Z"
      },
      {
        "from": "open",
        "to": "in_progress",
        "changed_by": "Agent Sarah",
        "changed_at": "2026-03-03T10:45:00Z"
      }
    ],
    "created_at": "2026-03-03T10:30:00Z",
    "updated_at": "2026-03-03T11:00:00Z"
  }
}
```

**Error Responses:**

| Status | Code           | Description                   |
| ------ | -------------- | ----------------------------- |
| `401`  | `unauthorized` | Missing or invalid token      |
| `403`  | `forbidden`    | User does not own this ticket |
| `404`  | `not_found`    | Ticket does not exist         |

---

#### 4.3.3 `PATCH /api/v1/tickets/:id` — Update Ticket

**Called by:** Dashboard (CS Agent / Admin / Ministry)

**Request:**

```http
PATCH /api/v1/tickets/TKT-20260303-0001 HTTP/1.1
Host: api.example.com
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body Schema:**

```json
{
  "ticket": {
    "status": "in_progress",
    "priority": "critical",
    "assigned_to_id": 5,
    "assigned_department": "Ministry of Public Works",
    "internal_notes": "Dispatched field team Alpha.",
    "resolution_notes": null
  },
  "message": {
    "body": "We have dispatched a team to the location. ETA 30 minutes.",
    "notify_user": true
  }
}
```

**Updatable Fields:**

| Field                        | Type    | Permission          | Validation                                |
| ---------------------------- | ------- | ------------------- | ----------------------------------------- |
| `ticket.status`              | string  | CS, Admin, Ministry | Must follow valid transition (see §6)     |
| `ticket.priority`            | string  | CS, Admin           | Enum: `low`, `medium`, `high`, `critical` |
| `ticket.assigned_to_id`      | integer | Admin               | Must reference valid staff user           |
| `ticket.assigned_department` | string  | Admin               | Must match registered department          |
| `ticket.internal_notes`      | string  | CS, Admin, Ministry | Max: 5000 chars (not visible to end user) |
| `ticket.resolution_notes`    | string  | CS, Admin, Ministry | Required when status → `resolved`         |
| `message.body`               | string  | CS, Admin, Ministry | Max: 2000 chars                           |
| `message.notify_user`        | boolean | CS, Admin           | If `true`, sends WhatsApp notification    |

**Success Response: `200 OK`**

```json
{
  "data": {
    "id": 1042,
    "ticket_number": "TKT-20260303-0001",
    "status": "in_progress",
    "priority": "critical",
    "assigned_to": {
      "id": 5,
      "name": "Agent Sarah",
      "role": "cs_agent"
    },
    "updated_at": "2026-03-03T11:00:00Z"
  },
  "meta": {
    "message": "Ticket updated successfully",
    "notification_sent": true
  }
}
```

**Error Responses:**

| Status | Code                   | Description                                    |
| ------ | ---------------------- | ---------------------------------------------- |
| `400`  | `invalid_transition`   | Status transition not allowed                  |
| `401`  | `unauthorized`         | Missing or invalid token                       |
| `403`  | `forbidden`            | Insufficient role permissions                  |
| `404`  | `not_found`            | Ticket does not exist                          |
| `422`  | `unprocessable_entity` | Missing `resolution_notes` for resolved status |

---

#### 4.3.4 `GET /api/v1/tickets` — List Tickets (Dashboard)

**Called by:** Dashboard

```http
GET /api/v1/tickets?status=open&category=emergency&page=1&per_page=25 HTTP/1.1
Authorization: Bearer <jwt_token>
```

**Query Parameters:**

| Parameter      | Type    | Default       | Description                            |
| -------------- | ------- | ------------- | -------------------------------------- |
| `status`       | string  | —             | Filter by status                       |
| `category`     | string  | —             | Filter by category                     |
| `priority`     | string  | —             | Filter by priority                     |
| `assigned_to`  | integer | —             | Filter by assigned agent ID            |
| `department`   | string  | —             | Filter by department                   |
| `sla_breached` | boolean | —             | Filter tickets with breached SLA       |
| `search`       | string  | —             | Full-text search on description        |
| `date_from`    | date    | —             | Created after this date                |
| `date_to`      | date    | —             | Created before this date               |
| `sort`         | string  | `-created_at` | Field to sort by (prefix `-` for desc) |
| `page`         | integer | 1             | Page number                            |
| `per_page`     | integer | 25            | Items per page (max: 100)              |

**Success Response: `200 OK`**

```json
{
  "data": [
    {
      "id": 1042,
      "ticket_number": "TKT-20260303-0001",
      "status": "open",
      "category": "emergency",
      "priority": "high",
      "description": "There is a fallen tree blocking...",
      "contact_name": "John Doe",
      "assigned_department": "Ministry of Public Works",
      "sla_deadline": "2026-03-03T14:30:00Z",
      "sla_breached": false,
      "created_at": "2026-03-03T10:30:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 25,
    "total_pages": 4,
    "total_count": 87
  }
}
```

---

#### 4.3.5 `POST /api/v1/auth/login` — User Authentication

**Called by:** Mobile/Web App

```http
POST /api/v1/auth/login HTTP/1.1
Content-Type: application/json

{
  "phone": "+6281234567890",
  "otp": "482901"
}
```

**Response: `200 OK`**

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 42,
      "name": "John Doe",
      "phone": "+6281234567890",
      "role": "user"
    }
  }
}
```

---

#### 4.3.6 `GET /api/v1/tickets/export.csv` — Export Tickets

**Called by:** Dashboard (Admin only)

```http
GET /api/v1/tickets/export.csv?status=resolved&date_from=2026-01-01 HTTP/1.1
Authorization: Bearer <jwt_token>
Accept: text/csv
```

Returns a CSV file download with all matching tickets.

---

## 5. Database Design

### 5.1 Entity Relationship Diagram (Textual)

```
users ─────────< tickets >──────── categories
  │                 │
  │                 ├──────< ticket_messages
  │                 │
  │                 ├──────< attachments
  │                 │
  │                 └──────< ticket_status_histories
  │
  └── (role: user | cs_agent | admin | ministry)
```

### 5.2 Table Definitions

#### 5.2.1 `users`

| Column               | Type           | Constraints                    | Description                                   |
| -------------------- | -------------- | ------------------------------ | --------------------------------------------- |
| `id`                 | `bigint`       | PK, auto-increment             | Primary key                                   |
| `name`               | `varchar(255)` | NOT NULL                       | Full name                                     |
| `email`              | `varchar(255)` | UNIQUE, NULL allowed           | Email address                                 |
| `phone`              | `varchar(20)`  | NOT NULL, UNIQUE               | E.164 phone number                            |
| `whatsapp_id`        | `varchar(50)`  | UNIQUE, NULL allowed           | WhatsApp JID                                  |
| `role`               | `varchar(20)`  | NOT NULL, DEFAULT `'user'`     | Enum: `user`, `cs_agent`, `admin`, `ministry` |
| `department`         | `varchar(255)` | NULL                           | For ministry/admin users                      |
| `encrypted_password` | `varchar(255)` | NULL (OTP users don't need it) | Devise password hash                          |
| `otp_secret`         | `varchar(255)` | NULL                           | TOTP/HOTP secret                              |
| `is_active`          | `boolean`      | DEFAULT `true`                 | Soft active/inactive flag                     |
| `last_login_at`      | `timestamp`    | NULL                           | Last login timestamp                          |
| `created_at`         | `timestamp`    | NOT NULL                       | Record creation                               |
| `updated_at`         | `timestamp`    | NOT NULL                       | Record update                                 |

**Indexes:**

- `index_users_on_email` (UNIQUE, WHERE email IS NOT NULL)
- `index_users_on_phone` (UNIQUE)
- `index_users_on_whatsapp_id` (UNIQUE, WHERE whatsapp_id IS NOT NULL)
- `index_users_on_role`

---

#### 5.2.2 `categories`

| Column                | Type           | Constraints            | Description                        |
| --------------------- | -------------- | ---------------------- | ---------------------------------- |
| `id`                  | `bigint`       | PK, auto-increment     | Primary key                        |
| `name`                | `varchar(100)` | NOT NULL, UNIQUE       | Category name                      |
| `slug`                | `varchar(100)` | NOT NULL, UNIQUE       | URL-safe identifier                |
| `description`         | `text`         | NULL                   | Category description               |
| `default_priority`    | `varchar(20)`  | DEFAULT `'medium'`     | Default priority for this category |
| `sla_hours`           | `integer`      | NOT NULL, DEFAULT `24` | SLA resolution time in hours       |
| `assigned_department` | `varchar(255)` | NULL                   | Auto-assign to this department     |
| `is_active`           | `boolean`      | DEFAULT `true`         | Whether category is selectable     |
| `created_at`          | `timestamp`    | NOT NULL               | Record creation                    |
| `updated_at`          | `timestamp`    | NOT NULL               | Record update                      |

**Seed Data:**

| name      | slug      | default_priority | sla_hours | assigned_department       |
| --------- | --------- | ---------------- | --------- | ------------------------- |
| Emergency | emergency | critical         | 4         | Ministry of Public Safety |
| Complaint | complaint | medium           | 24        | Ministry of Tourism       |
| Others    | others    | low              | 48        | General Affairs           |

---

#### 5.2.3 `tickets`

| Column                     | Type            | Constraints                    | Description                                                    |
| -------------------------- | --------------- | ------------------------------ | -------------------------------------------------------------- |
| `id`                       | `bigint`        | PK, auto-increment             | Primary key                                                    |
| `ticket_number`            | `varchar(20)`   | NOT NULL, UNIQUE               | Human-readable ID: `TKT-YYYYMMDD-XXXX`                         |
| `user_id`                  | `bigint`        | FK → `users.id`, NOT NULL      | Ticket submitter                                               |
| `category_id`              | `bigint`        | FK → `categories.id`, NOT NULL | Ticket category                                                |
| `assigned_to_id`           | `bigint`        | FK → `users.id`, NULL          | Assigned CS/Ministry agent                                     |
| `status`                   | `varchar(20)`   | NOT NULL, DEFAULT `'open'`     | Enum: `open`, `in_progress`, `escalated`, `resolved`, `closed` |
| `priority`                 | `varchar(20)`   | NOT NULL, DEFAULT `'medium'`   | Enum: `low`, `medium`, `high`, `critical`                      |
| `description`              | `text`          | NOT NULL                       | Complaint/report description                                   |
| `latitude`                 | `decimal(10,7)` | NULL                           | GPS latitude                                                   |
| `longitude`                | `decimal(10,7)` | NULL                           | GPS longitude                                                  |
| `address`                  | `varchar(500)`  | NULL                           | Human-readable address                                         |
| `contact_name`             | `varchar(255)`  | NOT NULL                       | Reporter name                                                  |
| `contact_phone`            | `varchar(20)`   | NOT NULL                       | Reporter phone                                                 |
| `contact_email`            | `varchar(255)`  | NULL                           | Reporter email                                                 |
| `source_channel`           | `varchar(20)`   | NOT NULL, DEFAULT `'whatsapp'` | Enum: `whatsapp`, `web`, `mobile`                              |
| `botpress_conversation_id` | `varchar(100)`  | NULL                           | Botpress conversation reference                                |
| `internal_notes`           | `text`          | NULL                           | Internal staff notes                                           |
| `resolution_notes`         | `text`          | NULL                           | Resolution description                                         |
| `sla_deadline`             | `timestamp`     | NOT NULL                       | SLA expiration time                                            |
| `sla_breached`             | `boolean`       | DEFAULT `false`                | Whether SLA was breached                                       |
| `sla_breached_at`          | `timestamp`     | NULL                           | When SLA was breached                                          |
| `resolved_at`              | `timestamp`     | NULL                           | When ticket was resolved                                       |
| `closed_at`                | `timestamp`     | NULL                           | When ticket was closed                                         |
| `created_at`               | `timestamp`     | NOT NULL                       | Record creation                                                |
| `updated_at`               | `timestamp`     | NOT NULL                       | Record update                                                  |

**Indexes:**

- `index_tickets_on_ticket_number` (UNIQUE)
- `index_tickets_on_user_id`
- `index_tickets_on_category_id`
- `index_tickets_on_assigned_to_id`
- `index_tickets_on_status`
- `index_tickets_on_priority`
- `index_tickets_on_sla_breached`
- `index_tickets_on_created_at`
- `index_tickets_on_status_and_priority` (composite)
- `index_tickets_on_status_and_sla_deadline` (composite)

---

#### 5.2.4 `ticket_messages`

| Column        | Type          | Constraints                 | Description                                             |
| ------------- | ------------- | --------------------------- | ------------------------------------------------------- |
| `id`          | `bigint`      | PK, auto-increment          | Primary key                                             |
| `ticket_id`   | `bigint`      | FK → `tickets.id`, NOT NULL | Parent ticket                                           |
| `author_id`   | `bigint`      | FK → `users.id`, NULL       | Message author (NULL = system)                          |
| `author_type` | `varchar(20)` | NOT NULL                    | Enum: `user`, `cs_agent`, `admin`, `ministry`, `system` |
| `body`        | `text`        | NOT NULL                    | Message content                                         |
| `is_internal` | `boolean`     | DEFAULT `false`             | If `true`, not visible to end user                      |
| `metadata`    | `jsonb`       | DEFAULT `'{}'`              | Additional structured data                              |
| `created_at`  | `timestamp`   | NOT NULL                    | Record creation                                         |
| `updated_at`  | `timestamp`   | NOT NULL                    | Record update                                           |

**Indexes:**

- `index_ticket_messages_on_ticket_id`
- `index_ticket_messages_on_author_id`
- `index_ticket_messages_on_created_at`

---

#### 5.2.5 `attachments`

| Column           | Type            | Constraints                 | Description                  |
| ---------------- | --------------- | --------------------------- | ---------------------------- |
| `id`             | `bigint`        | PK, auto-increment          | Primary key                  |
| `ticket_id`      | `bigint`        | FK → `tickets.id`, NOT NULL | Parent ticket                |
| `uploaded_by_id` | `bigint`        | FK → `users.id`, NULL       | Uploader (NULL = bot upload) |
| `filename`       | `varchar(255)`  | NOT NULL                    | Original filename            |
| `content_type`   | `varchar(100)`  | NOT NULL                    | MIME type                    |
| `size_bytes`     | `bigint`        | NOT NULL                    | File size in bytes           |
| `storage_key`    | `varchar(500)`  | NOT NULL                    | S3 object key                |
| `url`            | `varchar(1000)` | NOT NULL                    | Public/signed URL            |
| `checksum`       | `varchar(64)`   | NOT NULL                    | SHA-256 checksum             |
| `scanned`        | `boolean`       | DEFAULT `false`             | Virus scan completed         |
| `scan_result`    | `varchar(20)`   | NULL                        | `clean` / `infected`         |
| `created_at`     | `timestamp`     | NOT NULL                    | Record creation              |
| `updated_at`     | `timestamp`     | NOT NULL                    | Record update                |

**Indexes:**

- `index_attachments_on_ticket_id`
- `index_attachments_on_storage_key` (UNIQUE)
- `index_attachments_on_checksum`

---

#### 5.2.6 `ticket_status_histories`

| Column          | Type          | Constraints                 | Description                  |
| --------------- | ------------- | --------------------------- | ---------------------------- |
| `id`            | `bigint`      | PK, auto-increment          | Primary key                  |
| `ticket_id`     | `bigint`      | FK → `tickets.id`, NOT NULL | Parent ticket                |
| `changed_by_id` | `bigint`      | FK → `users.id`, NULL       | Who made the change          |
| `from_status`   | `varchar(20)` | NULL                        | Previous status (NULL = new) |
| `to_status`     | `varchar(20)` | NOT NULL                    | New status                   |
| `reason`        | `text`        | NULL                        | Reason for change            |
| `created_at`    | `timestamp`   | NOT NULL                    | When the change occurred     |

**Indexes:**

- `index_ticket_status_histories_on_ticket_id`
- `index_ticket_status_histories_on_created_at`

---

### 5.3 Rails Model Relationships

```ruby
# app/models/user.rb
class User < ApplicationRecord
  has_many :submitted_tickets, class_name: 'Ticket', foreign_key: :user_id
  has_many :assigned_tickets,  class_name: 'Ticket', foreign_key: :assigned_to_id
  has_many :ticket_messages,   foreign_key: :author_id

  enum role: { user: 'user', cs_agent: 'cs_agent', admin: 'admin', ministry: 'ministry' }
end

# app/models/category.rb
class Category < ApplicationRecord
  has_many :tickets
  validates :name, :slug, presence: true, uniqueness: true
end

# app/models/ticket.rb
class Ticket < ApplicationRecord
  belongs_to :user
  belongs_to :category
  belongs_to :assigned_to, class_name: 'User', optional: true
  has_many   :ticket_messages, dependent: :destroy
  has_many   :attachments,     dependent: :destroy
  has_many   :status_histories, class_name: 'TicketStatusHistory', dependent: :destroy

  enum status:   { open: 'open', in_progress: 'in_progress', escalated: 'escalated', resolved: 'resolved', closed: 'closed' }
  enum priority: { low: 'low', medium: 'medium', high: 'high', critical: 'critical' }

  before_create :generate_ticket_number
  after_create  :create_initial_status_history
  after_update  :track_status_change, if: :saved_change_to_status?
end

# app/models/ticket_message.rb
class TicketMessage < ApplicationRecord
  belongs_to :ticket
  belongs_to :author, class_name: 'User', optional: true
end

# app/models/attachment.rb
class Attachment < ApplicationRecord
  belongs_to :ticket
  belongs_to :uploaded_by, class_name: 'User', optional: true
end

# app/models/ticket_status_history.rb
class TicketStatusHistory < ApplicationRecord
  belongs_to :ticket
  belongs_to :changed_by, class_name: 'User', optional: true
end
```

### 5.4 Migration Example

```ruby
# db/migrate/20260303000001_create_tickets.rb
class CreateTickets < ActiveRecord::Migration[7.1]
  def change
    create_table :tickets do |t|
      t.string     :ticket_number,    null: false, limit: 20
      t.references :user,             null: false, foreign_key: true
      t.references :category,         null: false, foreign_key: true
      t.references :assigned_to,      null: true,  foreign_key: { to_table: :users }
      t.string     :status,           null: false, default: 'open', limit: 20
      t.string     :priority,         null: false, default: 'medium', limit: 20
      t.text       :description,      null: false
      t.decimal    :latitude,         precision: 10, scale: 7
      t.decimal    :longitude,        precision: 10, scale: 7
      t.string     :address,          limit: 500
      t.string     :contact_name,     null: false, limit: 255
      t.string     :contact_phone,    null: false, limit: 20
      t.string     :contact_email,    limit: 255
      t.string     :source_channel,   null: false, default: 'whatsapp', limit: 20
      t.string     :botpress_conversation_id, limit: 100
      t.text       :internal_notes
      t.text       :resolution_notes
      t.datetime   :sla_deadline,     null: false
      t.boolean    :sla_breached,     default: false
      t.datetime   :sla_breached_at
      t.datetime   :resolved_at
      t.datetime   :closed_at

      t.timestamps
    end

    add_index :tickets, :ticket_number, unique: true
    add_index :tickets, :status
    add_index :tickets, :priority
    add_index :tickets, :sla_breached
    add_index :tickets, :created_at
    add_index :tickets, [:status, :priority]
    add_index :tickets, [:status, :sla_deadline]
  end
end
```

---

## 6. Ticket Status Flow

### 6.1 Status State Machine

```
                         ┌─────────────┐
                         │             │
             ┌──────────►│  ESCALATED  ├──────────┐
             │           │             │          │
             │           └─────────────┘          │
             │                                     │
             │                                     ▼
       ┌─────┴──────┐   ┌──────────────┐   ┌─────────────┐   ┌──────────┐
       │            │   │              │   │             │   │          │
  ──►  │    OPEN    ├──►│ IN PROGRESS  ├──►│  RESOLVED   ├──►│  CLOSED  │
       │            │   │              │   │             │   │          │
       └────────────┘   └──────┬───────┘   └──────┬──────┘   └──────────┘
                               │                   │
                               │                   │
                               └──► ESCALATED ─────┘
                                   (can loop)
```

### 6.2 Valid Transitions

| From          | To            | Allowed Roles       | Conditions                                       |
| ------------- | ------------- | ------------------- | ------------------------------------------------ |
| —             | `open`        | System              | Automatic on ticket creation                     |
| `open`        | `in_progress` | CS, Admin           | Agent picks up the ticket                        |
| `open`        | `escalated`   | CS, Admin, System   | Manual escalation or SLA breach                  |
| `in_progress` | `escalated`   | CS, Admin, System   | Needs higher authority                           |
| `in_progress` | `resolved`    | CS, Admin, Ministry | Resolution provided; requires `resolution_notes` |
| `escalated`   | `in_progress` | Admin, Ministry     | De-escalation after review                       |
| `escalated`   | `resolved`    | Admin, Ministry     | Resolved at escalation level                     |
| `resolved`    | `closed`      | System, Admin       | Auto-close after 72h or manual                   |
| `resolved`    | `open`        | User (via reopen)   | User disputes resolution                         |

### 6.3 Status Definitions

| Status        | Description                                                    | SLA Active  |
| ------------- | -------------------------------------------------------------- | ----------- |
| `open`        | Ticket created, awaiting agent pickup                          | Yes         |
| `in_progress` | Agent actively working on the ticket                           | Yes         |
| `escalated`   | Escalated to ministry or higher authority                      | Yes (reset) |
| `resolved`    | Solution provided, awaiting user confirmation (72h auto-close) | No          |
| `closed`      | Ticket finalized, no further action                            | No          |

### 6.4 Rails Implementation

```ruby
# app/models/concerns/ticket_state_machine.rb
module TicketStateMachine
  extend ActiveSupport::Concern

  VALID_TRANSITIONS = {
    'open'        => %w[in_progress escalated],
    'in_progress' => %w[escalated resolved],
    'escalated'   => %w[in_progress resolved],
    'resolved'    => %w[closed open],
    'closed'      => []
  }.freeze

  included do
    validate :validate_status_transition, if: :status_changed?
  end

  def can_transition_to?(new_status)
    VALID_TRANSITIONS.fetch(status, []).include?(new_status)
  end

  private

  def validate_status_transition
    return if status_was.nil? # New record

    unless can_transition_to?(status)
      errors.add(:status, "cannot transition from '#{status_was}' to '#{status}'")
    end

    if status == 'resolved' && resolution_notes.blank?
      errors.add(:resolution_notes, "must be provided when resolving a ticket")
    end
  end
end
```

---

## 7. Botpress Flow Design

### 7.1 Intent Configuration

| Intent                | Training Phrases (examples)                                                                | Action                                    |
| --------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `complaint_create`    | "I want to make a complaint", "Report a problem", "Something is wrong", "I need to report" | Start complaint flow                      |
| `emergency_report`    | "Emergency!", "I need help now", "Urgent situation", "SOS"                                 | Start emergency flow (priority: critical) |
| `ticket_status_check` | "Check my ticket", "What's my ticket status?", "TKT-", "Track complaint"                   | Start status check flow                   |
| `talk_to_agent`       | "Talk to a human", "I need help from a person", "Connect me to agent"                      | Human handover flow                       |

### 7.2 Conversation Flow: Complaint Creation

```
START
  │
  ├─ [NLU] Detect intent: complaint_create / emergency_report
  │
  ▼
CATEGORY SELECTION
  │  Bot: "What type of issue would you like to report?"
  │  Options: [🚨 Emergency] [📝 Complaint] [📋 Others]
  │
  │  → If emergency_report intent detected, auto-select "Emergency"
  │
  ▼
DESCRIPTION CAPTURE
  │  Bot: "Please describe the issue in detail."
  │  Validation: min 10 characters
  │  Retry: "Could you provide more detail? Please describe what happened."
  │  Max retries: 2 → fallback to agent
  │
  ▼
IMAGE CAPTURE
  │  Bot: "Would you like to attach any photos? (Send images or type 'skip')"
  │  Accept: image/jpeg, image/png, image/webp (max 10MB each, max 5 images)
  │  Validation: Check file type and size
  │  On invalid: "Sorry, we only accept JPEG, PNG, or WebP images under 10MB."
  │  Store as: base64 in workflow variable
  │
  ▼
LOCATION CAPTURE
  │  Bot: "Please share your location by tapping the 📎 attachment button
  │        and selecting 'Location', or type the address."
  │  Accept:
  │    - WhatsApp location message → extract lat/lng
  │    - Free text → store as address string
  │  Optional: User can type 'skip'
  │
  ▼
CONTACT DETAILS
  │  Bot: "Please provide your contact information."
  │  Collect:
  │    - Name (auto-fill from WhatsApp profile if available)
  │    - Phone (auto-fill from WhatsApp number)
  │    - Email (optional, "Type 'skip' if not applicable")
  │  Validation: E.164 phone format, valid email format
  │
  ▼
CONFIRMATION
  │  Bot: "Here's a summary of your report:
  │        📋 Category: Emergency
  │        📝 Description: Fallen tree blocking road...
  │        📍 Location: Jl. Raya Ubud
  │        📷 Attachments: 2 photos
  │        👤 Name: John Doe
  │        📱 Phone: +6281234567890
  │
  │        Is this correct?"
  │  Options: [✅ Submit] [✏️ Edit] [❌ Cancel]
  │
  │  → "Edit" → return to CATEGORY SELECTION
  │  → "Cancel" → "Your report has been cancelled. Is there anything else?"
  │
  ▼
SUBMIT TO API
  │  Execute webhook: POST /api/v1/tickets
  │  On success:
  │    Bot: "✅ Your ticket has been created!
  │          🎫 Ticket Number: TKT-20260303-0001
  │          You can check the status anytime by saying 'Check my ticket'.
  │          We'll also notify you of any updates here on WhatsApp."
  │
  │  On error (4xx):
  │    Bot: "Sorry, there was an issue submitting your report.
  │          Please try again or say 'talk to agent' for help."
  │
  │  On error (5xx / timeout):
  │    Bot: "We're experiencing technical difficulties.
  │          Your information has been saved and we'll try again shortly.
  │          If urgent, please call [emergency number]."
  │    → Store data locally, enqueue retry
  │
  ▼
END
  │  Bot: "Is there anything else I can help you with?"
```

### 7.3 Conversation Flow: Status Check

```
START
  │
  ├─ [NLU] Detect intent: ticket_status_check
  │  Extract entity: ticket_number (regex: TKT-\d{8}-\d{4})
  │
  ▼
TICKET ID RESOLUTION
  │  If ticket_number extracted from message:
  │    → proceed to API call
  │  Else:
  │    Bot: "Please enter your ticket number (e.g., TKT-20260303-0001)"
  │    Validate: regex match
  │    Retry: 2 attempts → "Sorry, that doesn't look like a valid ticket number."
  │
  ▼
API CALL
  │  Execute webhook: GET /api/v1/tickets/:ticket_number
  │  Headers: { Authorization: Bearer <bot_api_key> }
  │
  ▼
DISPLAY RESULT
  │  On success:
  │    Bot: "📋 Ticket: TKT-20260303-0001
  │          📊 Status: In Progress
  │          🏢 Department: Ministry of Public Works
  │          👤 Agent: Sarah
  │          💬 Last Update: We have dispatched a team to the location.
  │          🕐 Updated: 2026-03-03 11:00 UTC"
  │
  │  On 404:
  │    Bot: "Sorry, we couldn't find that ticket number. Please check and try again."
  │
  │  On error:
  │    Bot: "Sorry, we're unable to check your ticket status right now.
  │          Please try again later or say 'talk to agent'."
  │
  ▼
END
```

### 7.4 Human Handover Logic

```
HANDOVER TRIGGER CONDITIONS:
  1. User explicitly requests: "talk to agent"
  2. Max retries exceeded in any flow step
  3. NLU confidence < 0.4 for 2 consecutive messages
  4. Emergency category with critical description keywords

HANDOVER FLOW:
  ┌─ Check working hours (configurable: Mon-Fri 08:00-17:00 local time)
  │
  ├─ WITHIN working hours:
  │    Bot: "I'm connecting you to a customer service agent. Please wait..."
  │    Action: Trigger Botpress HITL (Human-in-the-Loop) handover
  │    Queue: Assign to available agent in HITL inbox
  │    Timeout: If no agent responds in 5 min:
  │      Bot: "All agents are currently busy. Your message has been queued.
  │            We'll get back to you within 30 minutes."
  │      → Create ticket with status 'open' and flag 'agent_requested'
  │
  └─ OUTSIDE working hours:
       Bot: "Our agents are available Mon-Fri 8AM-5PM.
             Would you like to:
             1. Leave a message (we'll respond next business day)
             2. Submit a complaint ticket now
             3. Call emergency: [number]"
       → Option 1: Collect message, create ticket with note
       → Option 2: Start complaint flow
       → Option 3: Display emergency number
```

### 7.5 Fallback Handling

```
FALLBACK STRATEGY (3-tier):

Tier 1 - Soft Fallback (NLU confidence 0.3-0.6):
  Bot: "I'm not sure I understood that. Did you mean:
        1. Make a complaint
        2. Check ticket status
        3. Something else"

Tier 2 - Hard Fallback (NLU confidence < 0.3):
  Bot: "Sorry, I didn't understand that. Here's what I can help with:
        📝 Submit a complaint
        🔍 Check ticket status
        📞 Get contact numbers
        🗣️ Talk to a human agent

        Please choose an option or type your question again."

Tier 3 - Repeated Fallback (3 consecutive misunderstandings):
  Bot: "I'm having trouble understanding. Let me connect you to a human agent."
  → Trigger human handover flow
```

---

## 8. Automation

### 8.1 Auto Email to Ministry/Department

When a ticket is created, the system automatically sends an email notification to the relevant ministry or department based on the ticket category.

```ruby
# app/jobs/ticket_notification_job.rb
class TicketNotificationJob < ApplicationJob
  queue_as :notifications
  retry_on StandardError, wait: :polynomially_longer, attempts: 5

  def perform(ticket_id)
    ticket = Ticket.includes(:category, :user).find(ticket_id)
    department = ticket.category.assigned_department

    # Email to department
    TicketMailer.new_ticket_notification(ticket, department).deliver_now

    # Email to submitter (if email provided)
    if ticket.contact_email.present?
      TicketMailer.ticket_confirmation(ticket).deliver_now
    end

    # Log notification
    ticket.ticket_messages.create!(
      author_type: 'system',
      body: "Email notification sent to #{department}",
      is_internal: true
    )
  end
end
```

**Email Routing Configuration:**

| Category  | Department                | Email                        | CC                              |
| --------- | ------------------------- | ---------------------------- | ------------------------------- |
| Emergency | Ministry of Public Safety | safety@ministry.gov.example  | ops-center@ministry.gov.example |
| Complaint | Ministry of Tourism       | tourism@ministry.gov.example | cs-lead@example.com             |
| Others    | General Affairs           | general@ministry.gov.example | —                               |

### 8.2 Escalation Rules

```ruby
# app/jobs/escalation_check_job.rb
class EscalationCheckJob < ApplicationJob
  queue_as :escalations

  # Runs every 15 minutes via Sidekiq-Cron
  def perform
    # Rule 1: Auto-escalate tickets open > 50% of SLA time without pickup
    Ticket.where(status: 'open')
          .where('created_at < ?', Time.current - 30.minutes)
          .where('sla_deadline < ?', Time.current + (sla_remaining_threshold))
          .find_each do |ticket|
      escalate!(ticket, reason: 'No agent pickup within 50% of SLA window')
    end

    # Rule 2: Auto-escalate critical priority tickets not picked up in 15 min
    Ticket.where(status: 'open', priority: 'critical')
          .where('created_at < ?', 15.minutes.ago)
          .find_each do |ticket|
      escalate!(ticket, reason: 'Critical ticket not picked up within 15 minutes')
    end

    # Rule 3: Escalate in_progress tickets nearing SLA breach (< 25% time remaining)
    Ticket.where(status: 'in_progress')
          .where('sla_deadline < ?', Time.current + 1.hour)
          .where(sla_breached: false)
          .find_each do |ticket|
      escalate!(ticket, reason: 'SLA breach imminent (< 25% time remaining)')
    end
  end

  private

  def escalate!(ticket, reason:)
    ticket.update!(status: 'escalated')
    ticket.status_histories.create!(
      from_status: ticket.status_before_last_save,
      to_status: 'escalated',
      reason: reason
    )

    # Notify admin and department head
    EscalationMailer.ticket_escalated(ticket, reason).deliver_later
  end
end
```

**Escalation Matrix:**

| Priority | First Response SLA | Resolution SLA | Auto-Escalate If No Pickup | Escalate To             |
| -------- | ------------------ | -------------- | -------------------------- | ----------------------- |
| Critical | 15 minutes         | 4 hours        | 15 minutes                 | Admin + Department Head |
| High     | 30 minutes         | 8 hours        | 1 hour                     | Team Lead               |
| Medium   | 2 hours            | 24 hours       | 4 hours                    | Team Lead               |
| Low      | 4 hours            | 48 hours       | 12 hours                   | CS Supervisor           |

### 8.3 SLA Timer Logic

```ruby
# app/models/concerns/sla_calculator.rb
module SlaCalculator
  extend ActiveSupport::Concern

  # SLA hours are defined per category (see categories table)
  # Business hours: Mon-Fri 08:00-17:00 (configurable)

  BUSINESS_START = 8   # 08:00
  BUSINESS_END   = 17  # 17:00

  def calculate_sla_deadline
    category = self.category
    sla_hours = category.sla_hours

    if priority == 'critical'
      # Critical tickets use wall-clock time (24/7)
      self.sla_deadline = created_at + sla_hours.hours
    else
      # Non-critical tickets use business hours only
      self.sla_deadline = add_business_hours(created_at, sla_hours)
    end
  end

  def sla_remaining
    return 0 if sla_breached?
    [(sla_deadline - Time.current).to_i, 0].max
  end

  def sla_percentage_elapsed
    total = (sla_deadline - created_at).to_f
    elapsed = (Time.current - created_at).to_f
    [(elapsed / total * 100).round(1), 100.0].min
  end

  private

  def add_business_hours(start_time, hours)
    remaining = hours
    current = start_time

    while remaining > 0
      if current.on_weekday? && current.hour.between?(BUSINESS_START, BUSINESS_END - 1)
        end_of_day = current.change(hour: BUSINESS_END)
        available = ((end_of_day - current) / 1.hour).floor
        consume = [remaining, available].min
        current += consume.hours
        remaining -= consume
      else
        current = next_business_hour(current)
      end
    end

    current
  end

  def next_business_hour(time)
    candidate = time
    loop do
      candidate = candidate + 1.hour
      candidate = candidate.change(hour: BUSINESS_START) if candidate.hour >= BUSINESS_END
      candidate = candidate.next_weekday.change(hour: BUSINESS_START) unless candidate.on_weekday?
      break if candidate.on_weekday? && candidate.hour.between?(BUSINESS_START, BUSINESS_END - 1)
    end
    candidate
  end
end
```

**SLA Breach Detection (Cron):**

```ruby
# app/jobs/sla_breach_check_job.rb
class SlaBreachCheckJob < ApplicationJob
  queue_as :sla

  # Runs every 5 minutes via Sidekiq-Cron
  def perform
    Ticket.where(sla_breached: false)
          .where(status: %w[open in_progress escalated])
          .where('sla_deadline <= ?', Time.current)
          .find_each do |ticket|
      ticket.update!(
        sla_breached: true,
        sla_breached_at: Time.current
      )

      SlaBreachMailer.notify(ticket).deliver_later
      SlackNotifier.sla_breach(ticket) if defined?(SlackNotifier)

      ticket.ticket_messages.create!(
        author_type: 'system',
        body: "⚠️ SLA breached at #{Time.current.strftime('%Y-%m-%d %H:%M %Z')}",
        is_internal: true
      )
    end
  end
end
```

**Sidekiq-Cron Schedule:**

```yaml
# config/sidekiq_cron.yml
sla_breach_check:
  cron: "*/5 * * * *" # Every 5 minutes
  class: SlaBreachCheckJob
  description: "Check for SLA breaches"

escalation_check:
  cron: "*/15 * * * *" # Every 15 minutes
  class: EscalationCheckJob
  description: "Check escalation rules"

auto_close_resolved:
  cron: "0 * * * *" # Every hour
  class: AutoCloseResolvedTicketsJob
  description: "Auto-close resolved tickets after 72h"
```

---

## 9. Security Design

### 9.1 API Authentication

| Client    | Method                | Details                                                                                          |
| --------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| Botpress  | API Key + HMAC        | Static key in `Authorization` header; HMAC-SHA256 signature of request body in `X-Bot-Signature` |
| End User  | JWT (OTP-based login) | Phone OTP → JWT token (exp: 24h, refresh: 7d)                                                    |
| Dashboard | JWT (password login)  | Email/password → JWT token (exp: 8h)                                                             |

**HMAC Verification (for Botpress requests):**

```ruby
# app/middleware/botpress_signature_verification.rb
class BotpressSignatureVerification
  def initialize(app)
    @app = app
  end

  def call(env)
    request = Rack::Request.new(env)

    if request.env['HTTP_X_BOT_SIGNATURE'].present?
      body = request.body.read
      request.body.rewind

      expected = OpenSSL::HMAC.hexdigest(
        'SHA256',
        Rails.application.credentials.botpress[:hmac_secret],
        body
      )

      unless ActiveSupport::SecurityUtils.secure_compare(
        request.env['HTTP_X_BOT_SIGNATURE'], expected
      )
        return [401, { 'Content-Type' => 'application/json' },
                ['{"error":{"code":"invalid_signature","message":"HMAC signature mismatch"}}']]
      end
    end

    @app.call(env)
  end
end
```

### 9.2 Rate Limiting

```ruby
# config/initializers/rack_attack.rb
class Rack::Attack
  # Botpress API: 100 req/min
  throttle('botpress/api', limit: 100, period: 60) do |req|
    if req.env['HTTP_AUTHORIZATION']&.start_with?('Bearer bp_')
      req.env['HTTP_AUTHORIZATION']
    end
  end

  # User API: 60 req/min per IP
  throttle('user/api', limit: 60, period: 60) do |req|
    if req.path.start_with?('/api/v1')
      req.ip
    end
  end

  # Login attempts: 5 per minute per phone number
  throttle('login/phone', limit: 5, period: 60) do |req|
    if req.path == '/api/v1/auth/login' && req.post?
      JSON.parse(req.body.read).dig('phone') rescue nil
      req.body.rewind
    end
  end

  # OTP requests: 3 per 5 minutes per phone
  throttle('otp/request', limit: 3, period: 300) do |req|
    if req.path == '/api/v1/auth/otp' && req.post?
      JSON.parse(req.body.read).dig('phone') rescue nil
      req.body.rewind
    end
  end

  # Block suspicious IPs after 20 failed attempts
  blocklist('fail2ban/api') do |req|
    Rack::Attack::Allow2Ban.filter(req.ip, maxretry: 20, findtime: 300, bantime: 3600) do
      req.path.start_with?('/api/v1') && [401, 403].include?(req.env['rack.attack.match_data']&.dig(:status))
    end
  end

  # Custom response for rate-limited requests
  self.throttled_responder = lambda do |req|
    retry_after = (req.env['rack.attack.match_data'] || {})[:period]
    [
      429,
      { 'Content-Type' => 'application/json', 'Retry-After' => retry_after.to_s },
      [{ error: { code: 'rate_limited', message: 'Too many requests. Please retry later.', retry_after: retry_after } }.to_json]
    ]
  end
end
```

### 9.3 Data Validation

```ruby
# app/validators/ticket_validator.rb
class TicketValidator
  include ActiveModel::Validations

  ALLOWED_CATEGORIES = %w[emergency complaint others].freeze
  ALLOWED_PRIORITIES = %w[low medium high critical].freeze
  PHONE_REGEX = /\A\+[1-9]\d{6,14}\z/
  EMAIL_REGEX = /\A[\w+\-.]+@[a-z\d\-]+(\.[a-z\d\-]+)*\.[a-z]+\z/i

  validates :description, presence: true, length: { minimum: 10, maximum: 5000 }
  validates :category, presence: true, inclusion: { in: ALLOWED_CATEGORIES }
  validates :contact_name, presence: true, length: { maximum: 255 }
  validates :contact_phone, presence: true, format: { with: PHONE_REGEX }
  validates :contact_email, format: { with: EMAIL_REGEX }, allow_blank: true
  validates :latitude, numericality: { greater_than_or_equal_to: -90, less_than_or_equal_to: 90 }, allow_nil: true
  validates :longitude, numericality: { greater_than_or_equal_to: -180, less_than_or_equal_to: 180 }, allow_nil: true

  # Sanitize inputs
  before_validation :sanitize_description

  private

  def sanitize_description
    self.description = ActionController::Base.helpers.sanitize(description) if description.present?
  end
end
```

### 9.4 File Upload Security

```ruby
# app/services/attachment_service.rb
class AttachmentService
  ALLOWED_CONTENT_TYPES = %w[
    image/jpeg
    image/png
    image/webp
    application/pdf
  ].freeze

  MAX_FILE_SIZE = 10.megabytes
  MAX_ATTACHMENTS_PER_TICKET = 5

  MAGIC_BYTES = {
    'image/jpeg' => ["\xFF\xD8\xFF"],
    'image/png'  => ["\x89PNG"],
    'image/webp' => ["RIFF"],
    'application/pdf' => ["%PDF"]
  }.freeze

  def self.process(ticket, attachments_params)
    return if attachments_params.blank?

    if attachments_params.length > MAX_ATTACHMENTS_PER_TICKET
      raise ValidationError, "Maximum #{MAX_ATTACHMENTS_PER_TICKET} attachments allowed"
    end

    attachments_params.each do |attachment_param|
      validate_content_type!(attachment_param[:content_type])
      decoded = Base64.strict_decode64(attachment_param[:data])
      validate_file_size!(decoded)
      validate_magic_bytes!(decoded, attachment_param[:content_type])
      sanitized_filename = sanitize_filename(attachment_param[:filename])

      # Upload to S3
      key = "tickets/#{ticket.id}/#{SecureRandom.uuid}/#{sanitized_filename}"
      s3_url = S3Uploader.upload(key: key, body: decoded, content_type: attachment_param[:content_type])

      ticket.attachments.create!(
        filename: sanitized_filename,
        content_type: attachment_param[:content_type],
        size_bytes: decoded.bytesize,
        storage_key: key,
        url: s3_url,
        checksum: Digest::SHA256.hexdigest(decoded)
      )

      # Enqueue virus scan
      VirusScanJob.perform_later(ticket.attachments.last.id)
    end
  end

  private

  def self.validate_content_type!(content_type)
    unless ALLOWED_CONTENT_TYPES.include?(content_type)
      raise ValidationError, "File type '#{content_type}' is not allowed"
    end
  end

  def self.validate_file_size!(data)
    if data.bytesize > MAX_FILE_SIZE
      raise ValidationError, "File size exceeds #{MAX_FILE_SIZE / 1.megabyte}MB limit"
    end
  end

  def self.validate_magic_bytes!(data, content_type)
    expected = MAGIC_BYTES[content_type]
    return unless expected

    unless expected.any? { |magic| data.start_with?(magic) }
      raise ValidationError, "File content does not match declared type '#{content_type}'"
    end
  end

  def self.sanitize_filename(filename)
    filename.gsub(/[^\w\.\-]/, '_').gsub(/\.{2,}/, '.')[0..254]
  end
end
```

### 9.5 PII Handling

| Data Type       | Storage                     | Access                         | Retention                    |
| --------------- | --------------------------- | ------------------------------ | ---------------------------- |
| Phone number    | Encrypted at rest (AES-256) | Masked in logs (`+62****7890`) | Duration of ticket + 1 year  |
| Email           | Encrypted at rest           | Masked in logs                 | Duration of ticket + 1 year  |
| GPS coordinates | Plain (non-PII)             | Standard access                | Duration of ticket + 1 year  |
| Images          | S3 (SSE-S3 encryption)      | Signed URLs (4h expiry)        | Duration of ticket + 90 days |
| Name            | Plain                       | Standard access                | Duration of ticket + 1 year  |
| WhatsApp ID     | Encrypted at rest           | API-only access                | Duration of ticket + 1 year  |

**Encryption Implementation:**

```ruby
# app/models/concerns/pii_encryption.rb
module PiiEncryption
  extend ActiveSupport::Concern

  included do
    encrypts :contact_phone, deterministic: true  # Allows querying
    encrypts :contact_email, deterministic: true
    encrypts :whatsapp_id
  end
end

# Logging filter
# config/initializers/filter_parameter_logging.rb
Rails.application.config.filter_parameters += [
  :password, :phone, :email, :whatsapp_id, :contact_phone,
  :contact_email, :otp, :token, :secret, :data  # base64 image data
]
```

**Data Retention Job:**

```ruby
# app/jobs/data_retention_job.rb
class DataRetentionJob < ApplicationJob
  queue_as :maintenance

  # Runs weekly
  def perform
    # Delete attachments older than 90 days on closed tickets
    Attachment.joins(:ticket)
              .where(tickets: { status: 'closed' })
              .where('attachments.created_at < ?', 90.days.ago)
              .find_each do |attachment|
      S3Uploader.delete(attachment.storage_key)
      attachment.destroy!
    end

    # Anonymize PII on tickets closed > 1 year
    Ticket.where(status: 'closed')
          .where('closed_at < ?', 1.year.ago)
          .where.not(contact_phone: 'REDACTED')
          .find_each do |ticket|
      ticket.update_columns(
        contact_name: 'REDACTED',
        contact_phone: 'REDACTED',
        contact_email: nil,
        whatsapp_id: nil
      )
    end
  end
end
```

---

## 10. Dashboard Requirements

### 10.1 Role-Based Access Control (RBAC)

| Feature                     | Admin | CS Agent | Ministry      |
| --------------------------- | ----- | -------- | ------------- |
| View all tickets            | ✅    | ✅       | Own dept only |
| Create ticket (manual)      | ✅    | ✅       | ❌            |
| Update ticket status        | ✅    | ✅ (own) | ✅ (own dept) |
| Assign agent                | ✅    | ❌       | ❌            |
| Reassign department         | ✅    | ❌       | ❌            |
| View internal notes         | ✅    | ✅       | ✅            |
| View PII (full phone/email) | ✅    | ✅       | ❌            |
| Export CSV                  | ✅    | ❌       | Own dept only |
| Manage categories           | ✅    | ❌       | ❌            |
| Manage users                | ✅    | ❌       | ❌            |
| View SLA dashboard          | ✅    | ✅       | Own dept only |
| View analytics              | ✅    | ❌       | Own dept only |
| Configure escalation rules  | ✅    | ❌       | ❌            |

### 10.2 Dashboard Pages

#### 10.2.1 Ticket List View

- **Filters:** Status, Category, Priority, Department, Assigned Agent, SLA Breached (boolean), Date Range
- **Search:** Full-text search on description, ticket number, contact name
- **Sorting:** Created date, Updated date, Priority, SLA deadline
- **Columns:** Ticket #, Category, Priority (color-coded), Status (badge), Description (truncated), Contact Name, Department, Agent, SLA (countdown/breached), Created, Updated
- **Bulk actions:** Assign, Change status, Export selected
- **Pagination:** 25/50/100 per page

#### 10.2.2 Ticket Detail View

- **Header:** Ticket number, status badge, priority badge, SLA countdown
- **Tabs:**
  - **Details:** All ticket fields, location map (embed), attachments gallery
  - **Messages:** Conversation thread (internal + public)
  - **History:** Status change timeline
  - **Attachments:** File viewer with download
- **Actions:** Update status, Assign, Add message, Add internal note, Escalate
- **Sidebar:** Contact info, related tickets (same phone/email), ticket metadata

#### 10.2.3 SLA Monitoring Dashboard

- **Summary cards:** Total open, SLA OK (green), SLA warning <25% remaining (yellow), SLA breached (red)
- **Chart:** Tickets by SLA status (pie chart)
- **Chart:** SLA breach trend (last 30 days, line chart)
- **Table:** Tickets sorted by SLA deadline (nearest first)
- **Alerts:** Real-time SLA breach notifications (WebSocket)

#### 10.2.4 Analytics Page (Admin Only)

- **KPIs:** Avg. resolution time, SLA compliance %, Tickets per day, First response time
- **Charts:** Tickets by category (bar), by status (donut), by department (bar), trend over time (line)
- **Filters:** Date range, category, department

### 10.3 CSV Export Format

| Column           | Description                           |
| ---------------- | ------------------------------------- |
| ticket_number    | Ticket reference number               |
| category         | Category name                         |
| priority         | Priority level                        |
| status           | Current status                        |
| description      | Full description                      |
| contact_name     | Reporter name                         |
| contact_phone    | Reporter phone (masked for non-admin) |
| department       | Assigned department                   |
| agent            | Assigned agent name                   |
| sla_deadline     | SLA deadline timestamp                |
| sla_breached     | Yes/No                                |
| created_at       | Ticket creation timestamp             |
| resolved_at      | Resolution timestamp                  |
| closed_at        | Closure timestamp                     |
| resolution_notes | Resolution description                |

---

## 11. Future Scalability

### 11.1 Multi-Association Support

To support multiple organizations (tourism boards, municipalities, agencies) using the same platform:

```ruby
# Future: app/models/organization.rb
class Organization < ApplicationRecord
  has_many :users
  has_many :tickets, through: :users
  has_many :categories
  has_many :departments

  # Each organization has its own:
  # - Categories and SLA rules
  # - Department routing
  # - Branding (logo, colors for dashboard)
  # - API keys for Botpress
end
```

### 11.2 Multi-Tenant Architecture

```
┌─────────────────────────────────────────────────┐
│                MULTI-TENANT LAYER                │
│                                                   │
│  Strategy: Schema-based isolation (PostgreSQL)    │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Tenant A │  │ Tenant B │  │ Tenant C │       │
│  │ (schema) │  │ (schema) │  │ (schema) │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                   │
│  Gem: apartment (or acts_as_tenant)              │
│  Tenant resolution: subdomain or API key prefix  │
│                                                   │
│  Shared tables (public schema):                  │
│  - tenants, plans, billing                       │
│                                                   │
│  Per-tenant tables:                              │
│  - users, tickets, categories, etc.              │
└─────────────────────────────────────────────────┘
```

**Implementation approach:**

```ruby
# Gemfile
gem 'apartment', '~> 2.2'  # Or 'ros-apartment' for Rails 7+

# config/initializers/apartment.rb
Apartment.configure do |config|
  config.excluded_models = %w[Tenant Plan]
  config.tenant_names = -> { Tenant.pluck(:subdomain) }
end

# Tenant resolution middleware
class TenantResolver
  def initialize(app)
    @app = app
  end

  def call(env)
    request = Rack::Request.new(env)
    tenant = extract_tenant(request)
    Apartment::Tenant.switch!(tenant) if tenant
    @app.call(env)
  end

  private

  def extract_tenant(request)
    # From subdomain: tenant-a.api.example.com
    subdomain = request.host.split('.').first
    return subdomain if Tenant.exists?(subdomain: subdomain)

    # From API key prefix: bp_tenanta_live_abc123
    if (key = request.env['HTTP_AUTHORIZATION']&.delete_prefix('Bearer '))
      Tenant.find_by_api_key_prefix(key)&.subdomain
    end
  end
end
```

### 11.3 Webhook Retry Logic

```ruby
# app/services/webhook_dispatcher.rb
class WebhookDispatcher
  MAX_RETRIES = 5

  RETRY_INTERVALS = [
    30.seconds,   # Retry 1: 30s
    2.minutes,    # Retry 2: 2m
    10.minutes,   # Retry 3: 10m
    1.hour,       # Retry 4: 1h
    6.hours       # Retry 5: 6h
  ].freeze

  def self.dispatch(event:, payload:, webhook_url:)
    WebhookDeliveryJob.perform_later(
      event: event,
      payload: payload.to_json,
      webhook_url: webhook_url,
      attempt: 1,
      idempotency_key: SecureRandom.uuid
    )
  end
end

# app/jobs/webhook_delivery_job.rb
class WebhookDeliveryJob < ApplicationJob
  queue_as :webhooks

  def perform(event:, payload:, webhook_url:, attempt:, idempotency_key:)
    response = HTTParty.post(
      webhook_url,
      body: payload,
      headers: {
        'Content-Type' => 'application/json',
        'X-Webhook-Event' => event,
        'X-Webhook-Delivery' => idempotency_key,
        'X-Webhook-Signature' => sign_payload(payload)
      },
      timeout: 30
    )

    unless response.success?
      raise WebhookDeliveryError, "HTTP #{response.code}: #{response.body}"
    end

    WebhookLog.create!(
      event: event,
      url: webhook_url,
      status: 'delivered',
      response_code: response.code,
      attempt: attempt,
      idempotency_key: idempotency_key
    )
  rescue StandardError => e
    WebhookLog.create!(
      event: event,
      url: webhook_url,
      status: 'failed',
      error_message: e.message,
      attempt: attempt,
      idempotency_key: idempotency_key
    )

    if attempt < WebhookDispatcher::MAX_RETRIES
      interval = WebhookDispatcher::RETRY_INTERVALS[attempt - 1]
      self.class.set(wait: interval).perform_later(
        event: event,
        payload: payload,
        webhook_url: webhook_url,
        attempt: attempt + 1,
        idempotency_key: idempotency_key
      )
    else
      # Final failure: alert operations team
      AlertService.webhook_failure(event: event, url: webhook_url, attempts: attempt)
    end
  end

  private

  def sign_payload(payload)
    OpenSSL::HMAC.hexdigest('SHA256', Rails.application.credentials.webhook_secret, payload)
  end
end
```

### 11.4 Message Queue Architecture (Sidekiq)

```
┌─────────────────────────────────────────────────────────┐
│                    SIDEKIQ QUEUES                         │
│                                                           │
│  Priority order (highest to lowest):                      │
│                                                           │
│  1. critical     → Emergency ticket processing            │
│  2. notifications→ Email/WhatsApp notifications           │
│  3. webhooks     → Outbound webhook deliveries            │
│  4. default      → General background jobs                │
│  5. escalations  → SLA checks, escalation rules           │
│  6. sla          → SLA breach detection                   │
│  7. maintenance  → Data retention, cleanup                │
│  8. exports      → CSV export generation                  │
└─────────────────────────────────────────────────────────┘
```

**Sidekiq Configuration:**

```yaml
# config/sidekiq.yml
:concurrency: 10
:queues:
  - [critical, 7]
  - [notifications, 6]
  - [webhooks, 5]
  - [default, 4]
  - [escalations, 3]
  - [sla, 3]
  - [maintenance, 1]
  - [exports, 1]

:limits:
  exports: 2 # Max 2 concurrent export jobs
  webhooks: 5 # Max 5 concurrent webhook deliveries
```

### 11.5 Horizontal Scaling Considerations

| Component  | Scaling Strategy                             | Notes                               |
| ---------- | -------------------------------------------- | ----------------------------------- |
| Rails API  | Horizontal (multiple Puma workers behind LB) | Stateless; session in Redis         |
| Sidekiq    | Horizontal (multiple Sidekiq processes)      | Redis-backed; queue partitioning    |
| PostgreSQL | Vertical + Read replicas                     | Write to primary, read from replica |
| Redis      | Redis Cluster or Sentinel                    | Used by Sidekiq, caching, sessions  |
| S3         | Managed (auto-scales)                        | CDN for public assets (CloudFront)  |
| Botpress   | Botpress Cloud (auto-scales)                 | Or self-hosted with K8s             |

---

## 12. Example Rails Controller Code

### 12.1 Tickets Controller

```ruby
# app/controllers/api/v1/tickets_controller.rb
module Api
  module V1
    class TicketsController < BaseController
      before_action :authenticate_botpress!, only: [:create]
      before_action :authenticate_user!, only: [:show, :index, :update, :export]
      before_action :set_ticket, only: [:show, :update]
      before_action :authorize_ticket_access!, only: [:show]
      before_action :authorize_ticket_update!, only: [:update]

      # POST /api/v1/tickets
      # Called by: Botpress
      def create
        result = TicketCreationService.call(ticket_params)

        if result.success?
          render json: {
            data: TicketSerializer.new(result.ticket).as_json,
            meta: {
              message: 'Ticket created successfully',
              sla_hours: result.ticket.category.sla_hours
            }
          }, status: :created
        else
          render json: {
            error: {
              code: 'validation_error',
              message: 'Validation failed',
              details: result.errors.map { |e| { field: e.field, message: e.message, code: e.code } }
            },
            meta: { request_id: request.request_id, timestamp: Time.current.iso8601 }
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/tickets/:id
      # Called by: Botpress, Dashboard, Mobile/Web App
      def show
        includes = (params[:include] || '').split(',') & %w[messages attachments history]

        render json: {
          data: TicketSerializer.new(@ticket, includes: includes).as_json
        }, status: :ok
      end

      # GET /api/v1/tickets
      # Called by: Dashboard
      def index
        authorize! :list, Ticket

        tickets = TicketQueryService.call(
          scope: policy_scope(Ticket),
          filters: filter_params,
          sort: params[:sort] || '-created_at',
          page: params[:page] || 1,
          per_page: [params[:per_page]&.to_i || 25, 100].min
        )

        render json: {
          data: TicketSerializer.collection(tickets.records),
          meta: {
            current_page: tickets.current_page,
            per_page: tickets.per_page,
            total_pages: tickets.total_pages,
            total_count: tickets.total_count
          }
        }, status: :ok
      end

      # PATCH /api/v1/tickets/:id
      # Called by: Dashboard
      def update
        result = TicketUpdateService.call(
          ticket: @ticket,
          params: update_params,
          message_params: message_params,
          current_user: current_user
        )

        if result.success?
          render json: {
            data: TicketSerializer.new(result.ticket).as_json,
            meta: {
              message: 'Ticket updated successfully',
              notification_sent: result.notification_sent?
            }
          }, status: :ok
        else
          render json: {
            error: {
              code: result.error_code,
              message: result.error_message,
              details: result.errors
            }
          }, status: result.http_status
        end
      end

      # GET /api/v1/tickets/export.csv
      # Called by: Dashboard (Admin only)
      def export
        authorize! :export, Ticket

        ExportTicketsCsvJob.perform_later(
          user_id: current_user.id,
          filters: filter_params.to_h
        )

        render json: {
          meta: { message: 'Export started. You will receive an email with the download link.' }
        }, status: :accepted
      end

      private

      def set_ticket
        @ticket = Ticket.find_by!(ticket_number: params[:id]) rescue Ticket.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: { code: 'not_found', message: 'Ticket not found' } }, status: :not_found
      end

      def authenticate_botpress!
        api_key = request.headers['Authorization']&.delete_prefix('Bearer ')

        unless api_key == Rails.application.credentials.botpress[:api_key]
          render json: { error: { code: 'unauthorized', message: 'Invalid API key' } }, status: :unauthorized
        end
      end

      def authorize_ticket_access!
        unless current_user.admin? || current_user.cs_agent? ||
               @ticket.user_id == current_user.id ||
               (current_user.ministry? && @ticket.category.assigned_department == current_user.department)
          render json: { error: { code: 'forbidden', message: 'Access denied' } }, status: :forbidden
        end
      end

      def authorize_ticket_update!
        unless current_user.admin? || current_user.cs_agent? || current_user.ministry?
          render json: { error: { code: 'forbidden', message: 'Insufficient permissions' } }, status: :forbidden
        end
      end

      def ticket_params
        params.require(:ticket).permit(
          :category, :description, :priority,
          location: [:latitude, :longitude, :address],
          contact: [:name, :phone, :email, :whatsapp_id],
          attachments: [:filename, :content_type, :data],
          metadata: [:botpress_conversation_id, :source_channel, :locale, :submitted_at]
        )
      end

      def update_params
        params.require(:ticket).permit(
          :status, :priority, :assigned_to_id,
          :assigned_department, :internal_notes, :resolution_notes
        )
      end

      def message_params
        params[:message]&.permit(:body, :notify_user) || {}
      end

      def filter_params
        params.permit(
          :status, :category, :priority, :assigned_to,
          :department, :sla_breached, :search,
          :date_from, :date_to
        )
      end
    end
  end
end
```

### 12.2 Ticket Creation Service

```ruby
# app/services/ticket_creation_service.rb
class TicketCreationService
  Result = Struct.new(:success?, :ticket, :errors, keyword_init: true)

  def self.call(params)
    new(params).call
  end

  def initialize(params)
    @params = params
  end

  def call
    ActiveRecord::Base.transaction do
      # 1. Find or create user from contact details
      user = find_or_create_user

      # 2. Resolve category
      category = Category.find_by!(slug: @params[:category])

      # 3. Create ticket
      ticket = Ticket.new(
        user: user,
        category: category,
        description: @params[:description],
        priority: @params[:priority] || category.default_priority,
        latitude: @params.dig(:location, :latitude),
        longitude: @params.dig(:location, :longitude),
        address: @params.dig(:location, :address),
        contact_name: @params.dig(:contact, :name),
        contact_phone: @params.dig(:contact, :phone),
        contact_email: @params.dig(:contact, :email),
        source_channel: @params.dig(:metadata, :source_channel) || 'whatsapp',
        botpress_conversation_id: @params.dig(:metadata, :botpress_conversation_id)
      )

      ticket.calculate_sla_deadline
      ticket.save!

      # 4. Process attachments
      AttachmentService.process(ticket, @params[:attachments])

      # 5. Create initial system message
      ticket.ticket_messages.create!(
        author_type: 'system',
        body: "Ticket created via #{ticket.source_channel} chatbot"
      )

      # 6. Enqueue background jobs
      TicketNotificationJob.perform_later(ticket.id)
      SlaTimerJob.set(wait_until: ticket.sla_deadline).perform_later(ticket.id)

      Result.new(success?: true, ticket: ticket)
    end
  rescue ActiveRecord::RecordInvalid => e
    Result.new(
      success?: false,
      errors: e.record.errors.map { |err| OpenStruct.new(field: "ticket.#{err.attribute}", message: err.message, code: err.type) }
    )
  rescue StandardError => e
    Rails.logger.error("TicketCreationService error: #{e.message}")
    Result.new(
      success?: false,
      errors: [OpenStruct.new(field: nil, message: 'Internal error', code: 'server_error')]
    )
  end

  private

  def find_or_create_user
    phone = @params.dig(:contact, :phone)
    User.find_or_create_by!(phone: phone) do |u|
      u.name = @params.dig(:contact, :name)
      u.email = @params.dig(:contact, :email)
      u.whatsapp_id = @params.dig(:contact, :whatsapp_id)
      u.role = 'user'
    end
  end
end
```

### 12.3 Routes Configuration

```ruby
# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      # Authentication
      post   'auth/otp',    to: 'auth#request_otp'
      post   'auth/login',  to: 'auth#login'
      delete 'auth/logout', to: 'auth#logout'

      # Tickets
      resources :tickets, only: [:index, :create, :show, :update] do
        collection do
          get 'export', to: 'tickets#export', defaults: { format: :csv }
        end
        resources :messages, only: [:index, :create], controller: 'ticket_messages'
        resources :attachments, only: [:index, :create, :destroy], controller: 'ticket_attachments'
      end

      # Dashboard
      namespace :dashboard do
        get 'stats', to: 'stats#index'
        get 'sla',   to: 'stats#sla'
      end

      # Categories (Admin)
      resources :categories, only: [:index, :create, :update, :destroy]

      # Users (Admin)
      resources :users, only: [:index, :show, :create, :update]
    end
  end
end
```

---

## 13. Example Botpress Webhook Configuration

### 13.1 Botpress Action: Create Ticket

This action is called from the Botpress flow after all data has been collected.

```javascript
// botpress-actions/createTicket.js
// Botpress Execute Code Card — "Create Ticket via API"

const axios = require("axios");

const API_BASE_URL = env.RAILS_API_URL; // https://api.example.com/api/v1
const API_KEY = env.RAILS_API_KEY; // bp_live_abc123def456ghi789

/**
 * Creates a ticket in the Rails backend.
 *
 * Expected workflow variables:
 *   - workflow.category:    "emergency" | "complaint" | "others"
 *   - workflow.description: string
 *   - workflow.images:      array of { url, mimeType } from WhatsApp media
 *   - workflow.latitude:    number (from WhatsApp location)
 *   - workflow.longitude:   number (from WhatsApp location)
 *   - workflow.address:     string
 *   - workflow.contactName: string
 *   - workflow.contactPhone:string
 *   - workflow.contactEmail:string (optional)
 */
async function createTicket() {
  try {
    // 1. Convert WhatsApp media URLs to base64
    const attachments = [];
    if (workflow.images && workflow.images.length > 0) {
      for (const img of workflow.images) {
        try {
          const response = await axios.get(img.url, {
            responseType: "arraybuffer",
            timeout: 30000,
          });
          const base64 = Buffer.from(response.data).toString("base64");
          const filename = `photo_${Date.now()}_${attachments.length + 1}.jpg`;

          attachments.push({
            filename: filename,
            content_type: img.mimeType || "image/jpeg",
            data: base64,
          });
        } catch (imgErr) {
          console.warn(`Failed to download image: ${imgErr.message}`);
          // Continue without this image
        }
      }
    }

    // 2. Build request payload
    const payload = {
      ticket: {
        category: workflow.category,
        description: workflow.description,
        location: {
          latitude: workflow.latitude || null,
          longitude: workflow.longitude || null,
          address: workflow.address || null,
        },
        contact: {
          name: workflow.contactName,
          phone: workflow.contactPhone,
          email: workflow.contactEmail || null,
          whatsapp_id: event.target, // WhatsApp user ID from Botpress event
        },
        attachments: attachments,
        metadata: {
          botpress_conversation_id: event.conversationId,
          source_channel: "whatsapp",
          locale: user.language || "en",
          submitted_at: new Date().toISOString(),
        },
      },
    };

    // 3. Call Rails API
    const response = await axios.post(`${API_BASE_URL}/tickets`, payload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "X-Bot-Signature": generateHmac(JSON.stringify(payload)),
      },
      timeout: 30000,
    });

    // 4. Store response data in workflow variables
    workflow.ticketId = response.data.data.ticket_number;
    workflow.ticketStatus = response.data.data.status;
    workflow.slaDeadline = response.data.data.sla_deadline;
    workflow.apiSuccess = true;
    workflow.apiError = null;
  } catch (error) {
    console.error(
      "Ticket creation failed:",
      error.response?.data || error.message,
    );

    workflow.apiSuccess = false;
    workflow.apiError =
      error.response?.data?.error?.message || "Failed to create ticket";
    workflow.apiStatusCode = error.response?.status || 500;
  }
}

function generateHmac(body) {
  const crypto = require("crypto");
  return crypto
    .createHmac("sha256", env.RAILS_HMAC_SECRET)
    .update(body)
    .digest("hex");
}

return createTicket();
```

### 13.2 Botpress Action: Check Ticket Status

```javascript
// botpress-actions/checkTicketStatus.js
// Botpress Execute Code Card — "Check Ticket Status via API"

const axios = require("axios");

const API_BASE_URL = env.RAILS_API_URL;
const API_KEY = env.RAILS_API_KEY;

/**
 * Checks ticket status from the Rails backend.
 *
 * Expected workflow variables:
 *   - workflow.ticketNumber: string (e.g., "TKT-20260303-0001")
 */
async function checkTicketStatus() {
  try {
    const ticketNumber = workflow.ticketNumber;

    if (!ticketNumber || !ticketNumber.match(/^TKT-\d{8}-\d{4}$/)) {
      workflow.statusCheckSuccess = false;
      workflow.statusCheckError = "Invalid ticket number format";
      return;
    }

    const response = await axios.get(
      `${API_BASE_URL}/tickets/${ticketNumber}?include=messages`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    const ticket = response.data.data;

    // Store in workflow variables for display
    workflow.ticketData = {
      number: ticket.ticket_number,
      status: formatStatus(ticket.status),
      category: ticket.category,
      priority: ticket.priority,
      department: ticket.assigned_department,
      agent: ticket.assigned_to?.name || "Not yet assigned",
      lastMessage:
        ticket.messages?.[ticket.messages.length - 1]?.body || "No updates yet",
      lastUpdated: new Date(ticket.updated_at).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      createdAt: new Date(ticket.created_at).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    };

    workflow.statusCheckSuccess = true;
    workflow.statusCheckError = null;
  } catch (error) {
    workflow.statusCheckSuccess = false;

    if (error.response?.status === 404) {
      workflow.statusCheckError = "not_found";
    } else {
      workflow.statusCheckError = "api_error";
      console.error(
        "Status check failed:",
        error.response?.data || error.message,
      );
    }
  }
}

function formatStatus(status) {
  const statusMap = {
    open: "🟡 Open",
    in_progress: "🔵 In Progress",
    escalated: "🟠 Escalated",
    resolved: "🟢 Resolved",
    closed: "⚫ Closed",
  };
  return statusMap[status] || status;
}

return checkTicketStatus();
```

### 13.3 Botpress Environment Variables

Configure the following in Botpress Cloud → Bot Settings → Environment Variables (or in `.env` for self-hosted):

| Variable            | Value                            | Description         |
| ------------------- | -------------------------------- | ------------------- |
| `RAILS_API_URL`     | `https://api.example.com/api/v1` | Rails API base URL  |
| `RAILS_API_KEY`     | `bp_live_abc123def456ghi789`     | API key for auth    |
| `RAILS_HMAC_SECRET` | `your_hmac_secret_key_here`      | For request signing |

### 13.4 Botpress Flow Nodes (Visual Summary)

```
┌──────────────────────────────────────────────────────────────────┐
│  MAIN FLOW                                                        │
│                                                                    │
│  [Trigger: Intent = complaint_create OR emergency_report]          │
│       │                                                            │
│       ▼                                                            │
│  [Choice: Category Selection]──────── category → workflow.category │
│       │                                                            │
│       ▼                                                            │
│  [Capture: Description]────────── text → workflow.description      │
│       │ (validation: length >= 10)                                 │
│       │ (max retries: 2 → fallback)                                │
│       ▼                                                            │
│  [Capture: Images]─────────────── media → workflow.images[]        │
│       │ (optional: "type skip")                                    │
│       ▼                                                            │
│  [Capture: Location]───────────── location/text → workflow.lat/lng │
│       │ (optional: "type skip")                                    │
│       ▼                                                            │
│  [Capture: Contact Name]──────── text → workflow.contactName       │
│       │ (auto-fill from user profile if available)                 │
│       ▼                                                            │
│  [Capture: Contact Email]─────── text → workflow.contactEmail      │
│       │ (optional: "type skip")                                    │
│       ▼                                                            │
│  [Confirmation Card]                                               │
│       │                                                            │
│  ┌────┼──────┐                                                     │
│  │    │      │                                                     │
│  ▼    ▼      ▼                                                     │
│ [Submit] [Edit] [Cancel]                                           │
│  │       │       │                                                 │
│  │    [Loop ↑]  [End: "Cancelled"]                                │
│  ▼                                                                 │
│  [Execute Code: createTicket.js]                                   │
│       │                                                            │
│  ┌────┴────┐                                                       │
│  ▼         ▼                                                       │
│ [Success] [Failure]                                                │
│  │         │                                                       │
│  │      [Retry / Agent Handover]                                  │
│  ▼                                                                 │
│  [Text: "✅ Ticket TKT-... created!"]                             │
│       │                                                            │
│  [End: "Anything else I can help with?"]                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 14. Appendices

### Appendix A: Ticket Number Generation

```ruby
# app/models/concerns/ticket_numbering.rb
module TicketNumbering
  extend ActiveSupport::Concern

  included do
    before_create :generate_ticket_number
  end

  private

  def generate_ticket_number
    date_prefix = Date.current.strftime('%Y%m%d')
    last_ticket = Ticket.where('ticket_number LIKE ?', "TKT-#{date_prefix}-%")
                        .order(ticket_number: :desc)
                        .pick(:ticket_number)

    sequence = if last_ticket
                 last_ticket.split('-').last.to_i + 1
               else
                 1
               end

    self.ticket_number = "TKT-#{date_prefix}-#{sequence.to_s.rjust(4, '0')}"
  end
end
```

### Appendix B: Error Code Reference

| HTTP Status | Error Code              | Description                                     |
| ----------- | ----------------------- | ----------------------------------------------- |
| 400         | `validation_error`      | Request body failed validation                  |
| 400         | `invalid_transition`    | Invalid ticket status transition                |
| 401         | `unauthorized`          | Missing or invalid authentication               |
| 401         | `token_expired`         | JWT token has expired                           |
| 401         | `invalid_signature`     | HMAC signature mismatch                         |
| 403         | `forbidden`             | Authenticated but insufficient permissions      |
| 404         | `not_found`             | Resource does not exist                         |
| 409         | `conflict`              | Duplicate resource or race condition            |
| 413         | `payload_too_large`     | Request body or file exceeds size limit         |
| 422         | `unprocessable_entity`  | Semantically invalid data                       |
| 429         | `rate_limited`          | Too many requests; retry after specified period |
| 500         | `internal_server_error` | Unexpected server error                         |
| 502         | `bad_gateway`           | Upstream service unavailable                    |
| 503         | `service_unavailable`   | Server temporarily unavailable                  |

### Appendix C: Environment Configuration Reference

```bash
# .env (Rails)
# ─── Database ───
DATABASE_URL=postgresql://user:pass@localhost:5432/tickets_production

# ─── Redis ───
REDIS_URL=redis://localhost:6379/0

# ─── Botpress Integration ───
BOTPRESS_API_KEY=bp_live_abc123def456ghi789
BOTPRESS_HMAC_SECRET=your_hmac_secret_key_here
BOTPRESS_WEBHOOK_URL=https://chat.botpress.cloud/your-bot-id/webhook

# ─── JWT ───
JWT_SECRET=your_jwt_secret_256bit_minimum
JWT_EXPIRY=86400          # 24 hours (user)
JWT_DASHBOARD_EXPIRY=28800 # 8 hours (dashboard)

# ─── AWS S3 ───
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=tickets-attachments-production

# ─── Email ───
SMTP_HOST=email-smtp.ap-southeast-1.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=your_smtp_username
SMTP_PASSWORD=your_smtp_password
MAIL_FROM=noreply@example.com

# ─── Security ───
RAILS_MASTER_KEY=<your_master_key>
ALLOWED_ORIGINS=https://dashboard.example.com,https://app.example.com
```

### Appendix D: Testing Checklist

| #   | Test Case                                   | Type        | Priority |
| --- | ------------------------------------------- | ----------- | -------- |
| 1   | Create ticket with all fields               | Integration | Critical |
| 2   | Create ticket with minimum fields           | Integration | Critical |
| 3   | Create ticket with invalid category         | Integration | High     |
| 4   | Create ticket with oversized attachment     | Integration | High     |
| 5   | Create ticket with invalid file type        | Integration | High     |
| 6   | Retrieve ticket by ticket number            | Integration | Critical |
| 7   | Retrieve ticket by numeric ID               | Integration | High     |
| 8   | Retrieve non-existent ticket                | Integration | High     |
| 9   | Update ticket status (valid transition)     | Integration | Critical |
| 10  | Update ticket status (invalid transition)   | Integration | High     |
| 11  | Resolve ticket without resolution_notes     | Integration | High     |
| 12  | API key authentication (valid)              | Security    | Critical |
| 13  | API key authentication (invalid)            | Security    | Critical |
| 14  | HMAC signature verification                 | Security    | Critical |
| 15  | JWT authentication (valid/expired/tampered) | Security    | Critical |
| 16  | Rate limiting (exceed threshold)            | Security    | High     |
| 17  | Role-based access (CS/Admin/Ministry)       | Security    | Critical |
| 18  | SLA calculation (business hours)            | Unit        | High     |
| 19  | SLA breach detection                        | Unit        | High     |
| 20  | Escalation rules execution                  | Unit        | High     |
| 21  | Email notification dispatch                 | Integration | High     |
| 22  | WhatsApp notification delivery              | E2E         | High     |
| 23  | Botpress → Rails full flow                  | E2E         | Critical |
| 24  | File upload virus scan                      | Integration | Medium   |
| 25  | Data retention/anonymization                | Integration | Medium   |
| 26  | CSV export generation                       | Integration | Medium   |
| 27  | Concurrent ticket creation (race condition) | Load        | High     |
| 28  | Webhook retry logic (all 5 attempts)        | Integration | Medium   |

---

_End of Technical Integration Documentation_

_Document Version: 1.0.0 | Last Updated: 2026-03-03 | Status: Implementation-Ready_
