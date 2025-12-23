# PayDay Server

Backend API for the PayDay debt collection platform.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod

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
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payday?schema=public"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

Notes:
- If `prisma migrate dev` prints one port but tries to connect to another, you almost certainly have a **pooled** vs **direct** connection mismatch. In that case, set `DIRECT_URL` in your `.env` to a direct Postgres connection (same host/port as the real server), and re-run `npm run db:migrate`.
- Make sure your Postgres server is actually running and reachable at the host/port in `DATABASE_URL`.

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

## Windows quickstart (PowerShell)

If you don’t have `createdb`, you can create the database using `psql` (or a GUI like pgAdmin):

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
│   ├── services/          # Business logic
│   ├── middleware/        # Error handling
│   └── types/             # TypeScript types
├── prisma/
│   └── schema.prisma      # Database schema
├── package.json
└── tsconfig.json
```
