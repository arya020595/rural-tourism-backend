# Botpress × Rails — Step-by-Step Integration Guide

> A practical, step-by-step guide to connecting a **Botpress chatbot** (WhatsApp channel) with a **Ruby on Rails API** for the Complaint & Emergency Ticketing System.

| Field             | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| **Version**       | 1.0.0                                                        |
| **Date**          | 2026-03-03                                                   |
| **Prerequisites** | Botpress Cloud account, Rails 7.x app, WhatsApp Business API |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Step 1 — Set Up the Rails API](#2-step-1--set-up-the-rails-api)
3. [Step 2 — Create API Authentication](#3-step-2--create-api-authentication)
4. [Step 3 — Build the Tickets API](#4-step-3--build-the-tickets-api)
5. [Step 4 — Set Up Botpress Bot](#5-step-4--set-up-botpress-bot)
6. [Step 5 — Install WhatsApp Integration](#6-step-5--install-whatsapp-integration)
7. [Step 6 — Create Botpress Conversation Flows](#7-step-6--create-botpress-conversation-flows)
8. [Step 7 — Connect Botpress to Rails via Execute Code](#8-step-7--connect-botpress-to-rails-via-execute-code)
9. [Step 8 — Handle Rails → Botpress Notifications](#9-step-8--handle-rails--botpress-notifications)
10. [Step 9 — Test End-to-End](#10-step-9--test-end-to-end)
11. [Step 10 — Deploy to Production](#11-step-10--deploy-to-production)
12. [Diagrams](#12-diagrams)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Architecture Overview

```
┌──────────────┐     ┌────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  WhatsApp    │────▶│  Meta Cloud    │────▶│    Botpress      │────▶│  Rails API   │
│  User        │◀────│  API           │◀────│    Cloud         │◀────│  Backend     │
└──────────────┘     └────────────────┘     └─────────────────┘     └──────┬───────┘
                                                                           │
                                                    ┌──────────────────────┼──────────────┐
                                                    │                      │              │
                                                    ▼                      ▼              ▼
                                              ┌──────────┐        ┌────────────┐   ┌──────────┐
                                              │PostgreSQL │        │   Redis     │   │  AWS S3  │
                                              │ Database  │        │  (Sidekiq)  │   │ (Files)  │
                                              └──────────┘        └────────────┘   └──────────┘
```

### How Data Flows

1. **User → WhatsApp → Meta API** — User sends a message on WhatsApp
2. **Meta API → Botpress** — Meta forwards the message to Botpress via webhook
3. **Botpress (NLU)** — Detects intent (e.g., "create complaint", "check status")
4. **Botpress (Flow Engine)** — Collects structured data through conversation
5. **Botpress → Rails API** — Sends HTTP request via Execute Code card
6. **Rails API** — Processes request, stores in DB, triggers background jobs
7. **Rails → Botpress** — (Optional) Sends proactive notifications back to user

---

## 2. Step 1 — Set Up the Rails API

### 2.1 Create the Rails Project

```bash
# Create a new Rails API-only application
rails new complaint-api --api --database=postgresql
cd complaint-api

# Add required gems
bundle add devise devise-jwt rack-attack sidekiq aws-sdk-s3
```

### 2.2 Configure Database

```yaml
# config/database.yml
default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

development:
  <<: *default
  database: complaint_api_development

production:
  <<: *default
  url: <%= ENV["DATABASE_URL"] %>
```

### 2.3 Set Up Environment Variables

```bash
# .env (use dotenv-rails or Rails credentials)
BOTPRESS_API_KEY=bp_live_abc123def456ghi789
BOTPRESS_HMAC_SECRET=your_hmac_secret_key_here
BOTPRESS_WEBHOOK_URL=https://chat.botpress.cloud/<your-bot-id>/webhook

JWT_SECRET=your_jwt_secret_256bit_minimum
REDIS_URL=redis://localhost:6379/0

AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=complaint-attachments
AWS_REGION=ap-southeast-1
```

### 2.4 Create Database and Run Migrations

```bash
rails db:create
rails db:migrate
```

---

## 3. Step 2 — Create API Authentication

Botpress will authenticate to your Rails API using a static **API Key** + **HMAC signature**. Dashboard users use JWT.

### 3.1 API Key Authentication (for Botpress)

Create a middleware that verifies the API key from Botpress:

```ruby
# app/middleware/botpress_auth.rb
class BotpressAuth
  def initialize(app)
    @app = app
  end

  def call(env)
    request = Rack::Request.new(env)

    # Only check Botpress routes
    if request.path.start_with?('/api/v1/bot/')
      api_key = request.env['HTTP_AUTHORIZATION']&.delete_prefix('Bearer ')

      unless api_key == Rails.application.credentials.dig(:botpress, :api_key)
        return [401, { 'Content-Type' => 'application/json' },
                ['{"error": "Invalid API key"}']]
      end

      # Verify HMAC signature
      if request.env['HTTP_X_BOT_SIGNATURE'].present?
        body = request.body.read
        request.body.rewind
        expected = OpenSSL::HMAC.hexdigest(
          'SHA256',
          Rails.application.credentials.dig(:botpress, :hmac_secret),
          body
        )
        unless ActiveSupport::SecurityUtils.secure_compare(
          request.env['HTTP_X_BOT_SIGNATURE'], expected
        )
          return [401, { 'Content-Type' => 'application/json' },
                  ['{"error": "HMAC signature mismatch"}']]
        end
      end
    end

    @app.call(env)
  end
end
```

### 3.2 Register the Middleware

```ruby
# config/application.rb
config.middleware.use BotpressAuth
```

### 3.3 Generate API Key and HMAC Secret

```bash
# Generate a secure API key
ruby -e "require 'securerandom'; puts 'bp_live_' + SecureRandom.hex(20)"

# Generate HMAC secret
ruby -e "require 'securerandom'; puts SecureRandom.hex(32)"
```

Store both values in Rails credentials AND in Botpress environment variables (they must match).

---

## 4. Step 3 — Build the Tickets API

### 4.1 Generate the Ticket Model

```bash
rails generate model Ticket \
  ticket_number:string:uniq \
  user:references \
  category:references \
  status:string \
  priority:string \
  description:text \
  latitude:decimal \
  longitude:decimal \
  address:string \
  contact_name:string \
  contact_phone:string \
  contact_email:string \
  source_channel:string \
  sla_deadline:datetime \
  sla_breached:boolean \
  resolved_at:datetime

rails db:migrate
```

### 4.2 Create the Tickets Controller

```ruby
# app/controllers/api/v1/bot/tickets_controller.rb
module Api
  module V1
    module Bot
      class TicketsController < ApplicationController
        skip_before_action :authenticate_user! # Uses API key instead

        # POST /api/v1/bot/tickets
        # Called by Botpress Execute Code card
        def create
          ticket_data = params.require(:ticket).permit(
            :category, :description, :priority,
            location: [:latitude, :longitude, :address],
            contact: [:name, :phone, :email, :whatsapp_id],
            metadata: [:botpress_conversation_id, :source_channel]
          )

          # Find or create user from contact info
          user = User.find_or_create_by!(phone: ticket_data.dig(:contact, :phone)) do |u|
            u.name = ticket_data.dig(:contact, :name)
            u.role = 'user'
          end

          # Find category
          category = Category.find_by!(slug: ticket_data[:category])

          # Create ticket
          ticket = Ticket.create!(
            user: user,
            category: category,
            description: ticket_data[:description],
            priority: ticket_data[:priority] || category.default_priority,
            contact_name: ticket_data.dig(:contact, :name),
            contact_phone: ticket_data.dig(:contact, :phone),
            latitude: ticket_data.dig(:location, :latitude),
            longitude: ticket_data.dig(:location, :longitude),
            address: ticket_data.dig(:location, :address),
            source_channel: ticket_data.dig(:metadata, :source_channel) || 'whatsapp'
          )

          # Process attachments (if any)
          process_attachments(ticket, params[:ticket][:attachments])

          # Enqueue background jobs
          TicketNotificationJob.perform_later(ticket.id)

          render json: {
            data: {
              ticket_number: ticket.ticket_number,
              status: ticket.status,
              sla_deadline: ticket.sla_deadline
            },
            meta: { message: 'Ticket created successfully' }
          }, status: :created

        rescue ActiveRecord::RecordInvalid => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # GET /api/v1/bot/tickets/:ticket_number
        # Called by Botpress to check ticket status
        def show
          ticket = Ticket.find_by!(ticket_number: params[:id])

          render json: {
            data: {
              ticket_number: ticket.ticket_number,
              status: ticket.status,
              category: ticket.category.name,
              priority: ticket.priority,
              assigned_department: ticket.category.assigned_department,
              assigned_agent: ticket.assigned_to&.name || 'Not yet assigned',
              last_update: ticket.ticket_messages.last&.body || 'No updates yet',
              updated_at: ticket.updated_at,
              created_at: ticket.created_at
            }
          }
        rescue ActiveRecord::RecordNotFound
          render json: { error: 'Ticket not found' }, status: :not_found
        end

        private

        def process_attachments(ticket, attachments)
          return unless attachments.present?

          attachments.each do |att|
            decoded = Base64.strict_decode64(att[:data])
            ticket.attachments.create!(
              filename: att[:filename],
              content_type: att[:content_type],
              size_bytes: decoded.bytesize
            )
          end
        end
      end
    end
  end
end
```

### 4.3 Define Routes

```ruby
# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      # Routes called by Botpress (API Key auth)
      namespace :bot do
        resources :tickets, only: [:create, :show]
      end

      # Routes called by Dashboard (JWT auth)
      resources :tickets, only: [:index, :show, :update]
    end
  end
end
```

### 4.4 Test the API

```bash
# Start Rails server
rails server

# Test ticket creation (simulating what Botpress will send)
curl -X POST http://localhost:3000/api/v1/bot/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bp_live_abc123def456ghi789" \
  -d '{
    "ticket": {
      "category": "complaint",
      "description": "Fallen tree blocking road near tourist area",
      "contact": {
        "name": "John Doe",
        "phone": "+6281234567890",
        "whatsapp_id": "6281234567890@s.whatsapp.net"
      },
      "location": {
        "latitude": 5.9804,
        "longitude": 116.0735,
        "address": "Jl. Raya Kiulu, Sabah"
      },
      "metadata": {
        "source_channel": "whatsapp",
        "botpress_conversation_id": "conv_abc123"
      }
    }
  }'

# Expected response:
# {"data":{"ticket_number":"TKT-20260303-0001","status":"open",...}}
```

---

## 5. Step 4 — Set Up Botpress Bot

### 5.1 Create a New Bot

1. Go to [Botpress Cloud](https://app.botpress.cloud)
2. Click **"Create Bot"**
3. Name it: `Rural Tourism Complaint Bot`
4. Choose **"Start from scratch"**

### 5.2 Configure Environment Variables

In Botpress Studio → **Bot Settings** → **Environment Variables**, add:

| Variable            | Value                                     | Description                    |
| ------------------- | ----------------------------------------- | ------------------------------ |
| `RAILS_API_URL`     | `https://your-api.example.com/api/v1/bot` | Your Rails API URL             |
| `RAILS_API_KEY`     | `bp_live_abc123def456ghi789`              | API key (must match Rails)     |
| `RAILS_HMAC_SECRET` | `your_hmac_secret_here`                   | HMAC secret (must match Rails) |

### 5.3 Configure NLU Intents

In Botpress Studio → **NLU** → **Intents**, create:

| Intent                | Training Phrases                                                       |
| --------------------- | ---------------------------------------------------------------------- |
| `complaint_create`    | "I want to make a complaint", "Report a problem", "Something is wrong" |
| `emergency_report`    | "Emergency!", "I need help now", "Urgent situation", "SOS"             |
| `ticket_status_check` | "Check my ticket", "What's my ticket status?", "Track complaint"       |
| `talk_to_agent`       | "Talk to a human", "Connect me to agent", "I need help from a person"  |

---

## 6. Step 5 — Install WhatsApp Integration

### 6.1 Prerequisites

- A **Meta Business Account**
- A **WhatsApp Business API** phone number
- Access to the **Meta Developer Portal**

### 6.2 Install in Botpress

1. In Botpress Studio, click the **Integrations** icon (🧩 puzzle piece) in the left sidebar
2. Search for **"WhatsApp"**
3. Click **Install**
4. You'll be prompted to enter:
   - **Verify Token** — A string you create (e.g., `my_verify_token_123`)
   - **Phone Number ID** — From Meta Developer Portal
   - **Access Token** — From Meta Developer Portal

### 6.3 Configure Meta Webhook

In the Meta Developer Portal:

1. Go to your WhatsApp app → **Configuration** → **Webhooks**
2. Set the **Callback URL** to the URL provided by Botpress (shown after installing the integration)
3. Set the **Verify Token** to the same value you entered in Botpress
4. Subscribe to: `messages`, `message_deliveries`, `message_reads`

### 6.4 Verify

Send a WhatsApp message to your business number. You should see it appear in the Botpress Studio **Conversations** panel.

---

## 7. Step 6 — Create Botpress Conversation Flows

### 7.1 Main Flow Structure

Create the following flows in Botpress Studio:

```
Main Flow
├── Trigger: Intent = complaint_create
│   └── → Complaint Creation Flow
├── Trigger: Intent = emergency_report
│   └── → Complaint Creation Flow (auto-set category = "emergency")
├── Trigger: Intent = ticket_status_check
│   └── → Status Check Flow
├── Trigger: Intent = talk_to_agent
│   └── → Human Handover Flow
└── Fallback
    └── → "I didn't understand. Here's what I can help with..."
```

### 7.2 Complaint Creation Flow — Nodes

| #   | Node Type        | Purpose                                  | Stores In                             |
| --- | ---------------- | ---------------------------------------- | ------------------------------------- |
| 1   | **Choice**       | Ask category: Emergency/Complaint/Others | `workflow.category`                   |
| 2   | **Capture**      | Ask for description (min 10 chars)       | `workflow.description`                |
| 3   | **Capture**      | Ask for photo (optional, "skip")         | `workflow.images[]`                   |
| 4   | **Capture**      | Ask for location (GPS or text)           | `workflow.latitude/longitude/address` |
| 5   | **Capture**      | Ask for name (auto-fill from profile)    | `workflow.contactName`                |
| 6   | **Capture**      | Ask for email (optional, "skip")         | `workflow.contactEmail`               |
| 7   | **Text**         | Show summary & ask for confirmation      | —                                     |
| 8   | **Choice**       | Submit / Edit / Cancel                   | —                                     |
| 9   | **Execute Code** | Call Rails API (`POST /tickets`)         | `workflow.ticketId`                   |
| 10  | **Text**         | Show success or error message            | —                                     |

### 7.3 Status Check Flow — Nodes

| #   | Node Type        | Purpose                         | Stores In               |
| --- | ---------------- | ------------------------------- | ----------------------- |
| 1   | **Capture**      | Ask for ticket number           | `workflow.ticketNumber` |
| 2   | **Execute Code** | Call Rails API (`GET /tickets`) | `workflow.ticketData`   |
| 3   | **Text**         | Display ticket status           | —                       |

---

## 8. Step 7 — Connect Botpress to Rails via Execute Code

This is the **core integration point**. Use the **Execute Code** card in Botpress to make HTTP calls to your Rails API.

### 8.1 Create Ticket — Execute Code Card

In the Complaint Creation Flow, after the confirmation step, add an **Execute Code** card with this code:

```javascript
// === CREATE TICKET — Execute Code Card ===
const axios = require("axios");

const API_URL = env.RAILS_API_URL; // https://your-api.example.com/api/v1/bot
const API_KEY = env.RAILS_API_KEY; // bp_live_abc123...
const HMAC_SECRET = env.RAILS_HMAC_SECRET;

async function createTicket() {
  try {
    // 1. Convert WhatsApp media URLs to base64 (if images attached)
    const attachments = [];
    if (workflow.images && workflow.images.length > 0) {
      for (const img of workflow.images) {
        try {
          const response = await axios.get(img.url, {
            responseType: "arraybuffer",
            timeout: 30000,
          });
          attachments.push({
            filename: `photo_${Date.now()}_${attachments.length + 1}.jpg`,
            content_type: img.mimeType || "image/jpeg",
            data: Buffer.from(response.data).toString("base64"),
          });
        } catch (imgErr) {
          console.warn("Failed to download image:", imgErr.message);
        }
      }
    }

    // 2. Build the request payload
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
          phone: workflow.contactPhone || event.target,
          email: workflow.contactEmail || null,
          whatsapp_id: event.target,
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

    // 3. Generate HMAC signature
    const crypto = require("crypto");
    const signature = crypto
      .createHmac("sha256", HMAC_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");

    // 4. Call Rails API
    const response = await axios.post(`${API_URL}/tickets`, payload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "X-Bot-Signature": signature,
      },
      timeout: 30000,
    });

    // 5. Store response
    workflow.ticketId = response.data.data.ticket_number;
    workflow.ticketStatus = response.data.data.status;
    workflow.apiSuccess = true;
    workflow.apiError = null;
  } catch (error) {
    console.error(
      "Ticket creation failed:",
      error.response?.data || error.message,
    );
    workflow.apiSuccess = false;
    workflow.apiError =
      error.response?.data?.error || "Failed to create ticket";
  }
}

return createTicket();
```

### 8.2 After Execute Code — Add Conditional Transitions

Add an **Expression** card after the Execute Code card:

- **If** `workflow.apiSuccess === true` → Go to **Success Message** node:

  ```
  ✅ Your ticket has been created!
  🎫 Ticket Number: {{workflow.ticketId}}

  You can check the status anytime by saying "Check my ticket".
  We'll also notify you of any updates here on WhatsApp.
  ```

- **Else** → Go to **Error Message** node:
  ```
  Sorry, there was an issue submitting your report.
  Please try again or say "talk to agent" for help.
  ```

### 8.3 Check Ticket Status — Execute Code Card

In the Status Check Flow, add an **Execute Code** card:

```javascript
// === CHECK TICKET STATUS — Execute Code Card ===
const axios = require("axios");

const API_URL = env.RAILS_API_URL;
const API_KEY = env.RAILS_API_KEY;

async function checkStatus() {
  try {
    const ticketNumber = workflow.ticketNumber;

    // Validate format
    if (!ticketNumber || !ticketNumber.match(/^TKT-\d{8}-\d{4}$/)) {
      workflow.statusCheckSuccess = false;
      workflow.statusCheckError = "invalid_format";
      return;
    }

    const response = await axios.get(`${API_URL}/tickets/${ticketNumber}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    const ticket = response.data.data;

    // Format status for display
    const statusMap = {
      open: "🟡 Open",
      in_progress: "🔵 In Progress",
      escalated: "🟠 Escalated",
      resolved: "🟢 Resolved",
      closed: "⚫ Closed",
    };

    workflow.ticketData = {
      number: ticket.ticket_number,
      status: statusMap[ticket.status] || ticket.status,
      department: ticket.assigned_department,
      agent: ticket.assigned_agent,
      lastUpdate: ticket.last_update,
      updatedAt: new Date(ticket.updated_at).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    };

    workflow.statusCheckSuccess = true;
  } catch (error) {
    workflow.statusCheckSuccess = false;
    workflow.statusCheckError =
      error.response?.status === 404 ? "not_found" : "api_error";
  }
}

return checkStatus();
```

### 8.4 After Status Check — Display Result

Add a **Text** card:

```
📋 Ticket: {{workflow.ticketData.number}}
📊 Status: {{workflow.ticketData.status}}
🏢 Department: {{workflow.ticketData.department}}
👤 Agent: {{workflow.ticketData.agent}}
💬 Last Update: {{workflow.ticketData.lastUpdate}}
🕐 Updated: {{workflow.ticketData.updatedAt}}
```

---

## 9. Step 8 — Handle Rails → Botpress Notifications

When a CS agent updates a ticket, you can send a **proactive message** back to the user on WhatsApp via Botpress.

### 9.1 Rails: Send Notification to Botpress

```ruby
# app/services/botpress_notifier.rb
class BotpressNotifier
  BOTPRESS_URL = ENV['BOTPRESS_WEBHOOK_URL']
  # e.g., https://chat.botpress.cloud/<bot-id>/webhook

  def self.notify_user(ticket, message)
    return unless ticket.contact_phone.present?

    payload = {
      type: 'ticket_update',
      ticket_number: ticket.ticket_number,
      status: ticket.status,
      message: message,
      whatsapp_id: ticket.whatsapp_id,
      phone: ticket.contact_phone
    }

    HTTParty.post(BOTPRESS_URL, {
      body: payload.to_json,
      headers: {
        'Content-Type' => 'application/json',
        'Authorization' => "Bearer #{ENV['BOTPRESS_API_KEY']}"
      },
      timeout: 15
    })
  rescue StandardError => e
    Rails.logger.error("BotpressNotifier failed: #{e.message}")
  end
end
```

### 9.2 Call It When Ticket Is Updated

```ruby
# In your TicketsController#update or a service object:
after_action :notify_user_of_update, only: [:update]

def notify_user_of_update
  return unless @ticket.saved_change_to_status?

  BotpressNotifier.notify_user(
    @ticket,
    "Your ticket #{@ticket.ticket_number} status changed to: #{@ticket.status}"
  )
end
```

### 9.3 Botpress: Handle Incoming Webhook

In Botpress, create a **Trigger** that listens for incoming webhooks:

1. Create a new flow: **Proactive Notification Flow**
2. Add a **Trigger** → **Custom Event** → filter by `event.payload.type === 'ticket_update'`
3. Add a **Text** card:
   ```
   📢 Update on your ticket {{event.payload.ticket_number}}:
   📊 New Status: {{event.payload.status}}
   💬 {{event.payload.message}}
   ```

---

## 10. Step 9 — Test End-to-End

### 10.1 Pre-Flight Checklist

| #   | Check                       | Command / Action                                |
| --- | --------------------------- | ----------------------------------------------- |
| 1   | Rails server running        | `rails server`                                  |
| 2   | Rails API responds          | `curl http://localhost:3000/api/v1/bot/tickets` |
| 3   | Botpress bot published      | Click **Publish** in Botpress Studio            |
| 4   | WhatsApp integration active | Check integration status in Botpress            |
| 5   | Environment variables match | API key in Botpress == API key in Rails         |
| 6   | HMAC secret matches         | HMAC in Botpress == HMAC in Rails               |
| 7   | Correct API URL             | No trailing slash, correct protocol (https)     |

### 10.2 Test Scenario: Create a Ticket

1. Send **"I want to make a complaint"** on WhatsApp
2. Bot should ask for category → select **"Complaint"**
3. Bot asks for description → type **"Road is damaged near Kiulu junction"**
4. Bot asks for photo → send an image or type **"skip"**
5. Bot asks for location → share GPS location
6. Bot asks for name → type your name
7. Bot shows summary → select **"Submit"**
8. Bot should respond: **"✅ Ticket TKT-20260303-XXXX created!"**
9. Verify in Rails: `Ticket.last` should show the new ticket
10. Verify in DB: check that attachments and SLA jobs were created

### 10.3 Test Scenario: Check Ticket Status

1. Send **"Check my ticket TKT-20260303-0001"** on WhatsApp
2. Bot should respond with ticket details (status, department, last update)

### 10.4 Test Scenario: Error Handling

1. Send a complaint but with a **very short description** (< 10 chars) → Bot should ask again
2. Enter an **invalid ticket number** → Bot should say "not found"
3. **Stop the Rails server** and try to create a ticket → Bot should show error message

---

## 11. Step 10 — Deploy to Production

### 11.1 Rails Deployment

```bash
# Example: Deploy to a VPS or cloud server
# 1. Set production environment variables
export RAILS_ENV=production
export BOTPRESS_API_KEY=bp_live_your_production_key
export BOTPRESS_HMAC_SECRET=your_production_hmac_secret
export DATABASE_URL=postgresql://user:pass@db-host:5432/complaint_production

# 2. Precompile and migrate
rails assets:precompile
rails db:migrate

# 3. Start with Puma
bundle exec puma -C config/puma.rb

# 4. Start Sidekiq for background jobs
bundle exec sidekiq
```

### 11.2 Update Botpress Environment Variables

In Botpress Cloud → Bot Settings → Environment Variables:

| Variable            | Production Value                        |
| ------------------- | --------------------------------------- |
| `RAILS_API_URL`     | `https://api.yourdomain.com/api/v1/bot` |
| `RAILS_API_KEY`     | Your production API key                 |
| `RAILS_HMAC_SECRET` | Your production HMAC secret             |

### 11.3 Publish the Bot

1. Click **Publish** in Botpress Studio
2. Verify WhatsApp is still connected
3. Run the end-to-end test scenarios again in production

### 11.4 Production Checklist

- [ ] HTTPS enabled on Rails API (required for WhatsApp)
- [ ] CORS configured for production origins only
- [ ] Rate limiting enabled (Rack::Attack)
- [ ] Sidekiq running with proper queues
- [ ] Database backups configured
- [ ] Error monitoring (Sentry or similar) set up
- [ ] API key rotated from development values
- [ ] Logging configured (no sensitive data in logs)

---

## 12. Diagrams

### 12.1 System Architecture

```mermaid
graph TB
    subgraph Users["👤 End Users"]
        WA["WhatsApp User"]
        WEB["Web/Mobile App User"]
    end

    subgraph Botpress["🤖 Botpress Cloud"]
        NLU["NLU Engine<br/>(Intent Detection)"]
        FLOW["Flow Engine<br/>(Conversation Logic)"]
        EXEC["Execute Code Card<br/>(HTTP Webhook Calls)"]
        HITL["HITL Module<br/>(Human Handover)"]
        NLU --> FLOW
        FLOW --> EXEC
        FLOW --> HITL
    end

    subgraph Meta["📱 Meta Cloud API"]
        WAPI["WhatsApp Business API"]
    end

    subgraph Rails["🚂 Ruby on Rails API"]
        AUTH["Authentication<br/>(API Key + JWT)"]
        TICKETS["Tickets Controller<br/>(CRUD)"]
        USERS["Users Controller"]
        NOTIFY["Notification Service"]
        AUTH --> TICKETS
        AUTH --> USERS
        TICKETS --> NOTIFY
    end

    subgraph DB["🗄️ Database & Storage"]
        PG["PostgreSQL"]
        S3["AWS S3<br/>(Attachments)"]
        REDIS["Redis<br/>(Sidekiq Jobs)"]
    end

    subgraph Jobs["⚙️ Background Jobs (Sidekiq)"]
        EMAIL["Email Notifications"]
        SLA["SLA Timer"]
        ESC["Escalation Rules"]
    end

    WA -->|"Message"| WAPI
    WAPI -->|"Webhook"| NLU
    EXEC -->|"POST /api/v1/bot/tickets"| AUTH
    EXEC -->|"GET /api/v1/bot/tickets/:id"| AUTH
    NOTIFY -->|"Proactive Message"| Botpress
    TICKETS --> PG
    TICKETS --> S3
    TICKETS --> REDIS
    REDIS --> EMAIL
    REDIS --> SLA
    REDIS --> ESC
    WEB --> AUTH
```

### 12.2 Message Sequence — Ticket Creation

```mermaid
sequenceDiagram
    participant U as 👤 User (WhatsApp)
    participant M as 📱 Meta API
    participant B as 🤖 Botpress
    participant R as 🚂 Rails API
    participant DB as 🗄️ PostgreSQL
    participant SQ as ⚙️ Sidekiq

    U->>M: "I want to make a complaint"
    M->>B: Forward message (webhook)
    B->>B: NLU detects intent: complaint_create
    B->>U: "What type? [Emergency / Complaint / Others]"
    U->>M: "Complaint"
    M->>B: Forward
    B->>U: "Please describe the issue"
    U->>M: "Fallen tree blocking road..."
    M->>B: Forward
    B->>U: "Attach photos? (send images or type 'skip')"
    U->>M: Sends image
    M->>B: Forward media
    B->>U: "Share your location"
    U->>M: Shares GPS pin
    M->>B: Forward location
    B->>U: "Here's the summary. Submit?"
    U->>M: "Submit"
    M->>B: Forward

    Note over B,R: Execute Code Card fires HTTP request

    B->>R: POST /api/v1/bot/tickets
    R->>R: Validate API Key + HMAC
    R->>DB: INSERT ticket record
    R->>SQ: Enqueue notification + SLA jobs
    R-->>B: 201 Created {ticket_number: "TKT-20260303-0001"}
    B->>U: "✅ Ticket TKT-20260303-0001 created!"

    SQ->>SQ: Send email to ministry
    SQ->>SQ: Start SLA timer
```

### 12.3 Message Sequence — Status Check

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant B as 🤖 Botpress
    participant R as 🚂 Rails API
    participant DB as 🗄️ PostgreSQL

    U->>B: "Check my ticket TKT-20260303-0001"
    B->>B: NLU detects: ticket_status_check
    B->>B: Extract entity: TKT-20260303-0001
    B->>R: GET /api/v1/bot/tickets/TKT-20260303-0001
    R->>DB: SELECT * FROM tickets WHERE ticket_number = ...
    DB-->>R: Ticket data
    R-->>B: 200 OK {status: "in_progress", ...}
    B->>U: "📋 TKT-20260303-0001 — Status: 🔵 In Progress"
```

### 12.4 Ticket Status State Machine

```mermaid
stateDiagram-v2
    [*] --> open: Ticket Created
    open --> in_progress: Agent picks up
    open --> escalated: No pickup / SLA warning
    in_progress --> escalated: Needs higher authority
    in_progress --> resolved: Resolution provided
    escalated --> in_progress: De-escalated
    escalated --> resolved: Resolved at escalation
    resolved --> closed: Auto-close 72h / Manual
    resolved --> open: User reopens
    closed --> [*]
```

---

## 13. Troubleshooting

### Common Issues

| Problem                         | Cause                                | Solution                                                   |
| ------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Bot doesn't respond on WhatsApp | WhatsApp integration not configured  | Check Meta webhook URL & verify token                      |
| 401 Unauthorized from Rails     | API key mismatch                     | Ensure `RAILS_API_KEY` in Botpress matches Rails           |
| 401 HMAC signature mismatch     | HMAC secret mismatch or body changed | Ensure secrets match; sign the exact JSON body             |
| Timeout on Execute Code         | Rails server unreachable             | Check Rails is running; check firewall/CORS                |
| 422 Unprocessable Entity        | Missing required fields              | Check workflow variables are populated before API call     |
| Images not uploading            | Base64 conversion failed             | Check WhatsApp media URL is accessible; add error handling |
| Ticket number "not found"       | Wrong format or ticket doesn't exist | Validate regex: `TKT-\d{8}-\d{4}`                          |
| Bot says "I didn't understand"  | NLU confidence too low               | Add more training phrases to intents                       |
| Proactive messages not working  | Botpress webhook URL incorrect       | Check `BOTPRESS_WEBHOOK_URL` in Rails env                  |

### Debug Tips

```bash
# Check Rails logs for incoming requests
tail -f log/development.log | grep -E "POST|GET.*bot/tickets"

# Test API key manually
curl -H "Authorization: Bearer YOUR_KEY" http://localhost:3000/api/v1/bot/tickets/TKT-20260303-0001

# Check Botpress logs
# In Botpress Studio → Logs panel (bottom of screen)
# Look for Execute Code errors
```

---

## Quick Reference Card

```
┌──────────────────────────────────────────────────────────────┐
│              BOTPRESS → RAILS QUICK REFERENCE                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Create Ticket:   POST {RAILS_API_URL}/tickets               │
│  Check Status:    GET  {RAILS_API_URL}/tickets/{ticket_no}   │
│                                                               │
│  Auth Header:     Authorization: Bearer {RAILS_API_KEY}      │
│  HMAC Header:     X-Bot-Signature: HMAC-SHA256(body, secret) │
│                                                               │
│  Success:         Store workflow.ticketId from response       │
│  Error:           Set workflow.apiSuccess = false             │
│                                                               │
│  Env Vars:        RAILS_API_URL, RAILS_API_KEY,              │
│                   RAILS_HMAC_SECRET                           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

_End of Integration Guide_
