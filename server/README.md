# PayDay Server

Backend API for the PayDay debt collection platform.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Email**: Nodemailer (Gmail)
- **WhatsApp**: Twilio

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Setup

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Configure environment

Create a `.env` file in the `server/` directory.

You can start from `env.example` (copy it to `.env`) and edit the values.

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payday?schema=public"

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Email (Gmail) - Optional
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# WhatsApp (Twilio) - Optional
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=+14155238886
```

### 3. Set up the database

```bash
# Create the database (if not exists)
createdb payday

# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

### 4. Start the server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

The server will be available at `http://localhost:3001`

## Email Setup (Gmail)

To send real emails, configure Gmail with an App Password:

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)
3. **Add to `.env`**:
   ```env
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ```

### Test Email Configuration

```bash
curl -X POST http://localhost:3001/api/messaging/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

## WhatsApp Setup (Twilio)

To send WhatsApp messages, configure Twilio:

1. **Sign up** at https://www.twilio.com (free trial available with $15 credit)
2. **Get credentials** from the Twilio Console Dashboard
3. **Set up WhatsApp Sandbox**:
   - Go to: Messaging → Try it out → Send a WhatsApp message
   - Send the join code from your phone to the Twilio WhatsApp number
   - This links your phone to the sandbox for testing
4. **Add to `.env`**:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_WHATSAPP_NUMBER=+14155238886
   ```

### Test WhatsApp Configuration

```bash
curl -X POST http://localhost:3001/api/messaging/test-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'
```

> **Note**: For WhatsApp sandbox, recipients must first send the join message to the Twilio number.

## API Endpoints

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers (paginated, filterable) |
| GET | `/api/customers/:id` | Get customer by ID |
| GET | `/api/customers/:id/stats` | Get customer statistics |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Delete customer |

### Debts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/debts` | List debts (filter by customer, status) |
| GET | `/api/debts/:id` | Get debt with installments |
| POST | `/api/debts` | Create debt |
| PUT | `/api/debts/:id` | Update debt status |
| DELETE | `/api/debts/:id` | Delete debt |

### Installments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/installments` | List installments (filter by debt, status, overdue) |
| GET | `/api/installments/:id` | Get installment with payment history |
| POST | `/api/installments` | Create installment |
| PUT | `/api/installments/:id` | Update installment |
| DELETE | `/api/installments/:id` | Delete installment |

### Payments (ACID Transactional)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments` | List payments |
| GET | `/api/payments/:id` | Get payment with allocations |
| POST | `/api/payments` | Record payment |
| POST | `/api/payments/:id/allocate` | Allocate to installments (transactional) |
| POST | `/api/payments/:id/reverse` | Reverse payment (transactional) |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications |
| GET | `/api/notifications/:id` | Get notification with deliveries |
| GET | `/api/notifications/pending` | Get pending deliveries |
| GET | `/api/notifications/customer/:customerId/stats` | Customer notification stats |
| POST | `/api/notifications` | Create notification |
| POST | `/api/notifications/:id/deliver` | Create delivery attempt |
| PUT | `/api/notifications/deliveries/:deliveryId/status` | Update delivery status |

### Messaging
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messaging/status` | Check email/WhatsApp service status |
| POST | `/api/messaging/send-reminder` | Send payment reminder to customer |
| POST | `/api/messaging/test-email` | Test email configuration |
| POST | `/api/messaging/test-whatsapp` | Test WhatsApp configuration |

### Data Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import/parse` | Parse Excel file and return headers |
| POST | `/api/import/preview` | Preview import results |
| POST | `/api/import/execute` | Execute import to database |

## Database Schema

```
customers
  ├── debts
  │     ├── installments
  │     │     └── payment_allocations
  │     └── payments
  │           └── payment_allocations
  └── notifications
        └── notification_deliveries
```

## Key Features

### ACID Transactions
All payment-related operations (allocation, reversal) use database transactions to ensure:
- **Atomicity**: All or nothing
- **Consistency**: Data integrity maintained
- **Isolation**: Concurrent operations don't interfere
- **Durability**: Changes persist

### Idempotency
Payment creation supports `providerTxnId` for webhook idempotency - duplicate transaction IDs are rejected.

### Money Handling
- All amounts stored as `Decimal(12,2)`
- Never uses floating point arithmetic
- Currency codes validated against ISO 4217

### Real Messaging
- **Email**: Gmail via Nodemailer with HTML templates
- **WhatsApp**: Twilio API with formatted messages
- Delivery tracking with status updates

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:migrate` | Run database migrations |
| `npm run db:push` | Push schema changes (dev only) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

## Windows Quickstart (PowerShell)

If you don't have `createdb`, you can create the database using `psql` (or a GUI like pgAdmin):

```powershell
# Example: create the payday database (adjust user/host/port as needed)
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE payday;"

cd server
npm install
npm run db:migrate
npm run dev
```

## Project Structure

```
server/
├── src/
│   ├── index.ts           # Entry point
│   ├── app.ts             # Express app setup
│   ├── config/
│   │   └── database.ts    # Prisma client
│   ├── routes/            # Route definitions
│   ├── controllers/       # Request handlers
│   ├── services/
│   │   ├── customers.service.ts
│   │   ├── debts.service.ts
│   │   ├── installments.service.ts
│   │   ├── payments.service.ts
│   │   ├── notifications.service.ts
│   │   ├── import.service.ts
│   │   ├── email.service.ts      # Gmail/Nodemailer
│   │   └── whatsapp.service.ts   # Twilio
│   ├── middleware/        # Error handling
│   └── types/             # TypeScript types
├── prisma/
│   └── schema.prisma      # Database schema
├── package.json
└── tsconfig.json
```

## Troubleshooting

### Email not sending
- Verify 2FA is enabled on your Google account
- Make sure you're using an App Password, not your regular password
- Check that `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set correctly

### WhatsApp not sending
- Verify your Twilio credentials are correct
- For sandbox: recipient must have sent the join message first
- Check phone number format (include country code with +)

### Database connection issues
- Ensure PostgreSQL is running
- Verify `DATABASE_URL` credentials and port
- Check if the `payday` database exists
