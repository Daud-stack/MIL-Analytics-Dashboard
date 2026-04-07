# Avenues Clinic Intelligence Platform

A production-ready healthcare analytics dashboard built with Next.js, featuring 30+ pages covering clinical, financial, and AI-powered analytics.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS 4 + shadcn-style components
- **Charts:** Recharts
- **State:** Zustand (persisted to localStorage)
- **Auth:** NextAuth v5 (JWT-based, role-based access)
- **Database:** Prisma ORM + SQLite (dev) / PostgreSQL (prod)
- **Parsing:** PapaParse for CSV uploads
- **Stats:** 80+ built-in statistical and ML functions

## Quick Start

### Option 1: Local Development

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client and create database
npx prisma generate
npx prisma db push

# 3. (Optional) Seed demo users
npx tsx prisma/seed.ts

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the dashboard.

### Option 2: Docker

```bash
# Development (with hot reload)
docker compose up --build

# Production
docker compose -f docker-compose.prod.yml up --build -d
```

### Option 3: One-liner

```bash
npm run setup
```

## Demo Accounts

After seeding the database:

| Role    | Email                    | Password |
|---------|--------------------------|----------|
| Admin   | admin@avenues.clinic     | admin123 |
| Analyst | analyst@avenues.clinic   | admin123 |

> In development mode, authentication is bypassed — all pages are accessible without login.

## Project Structure

```
avenues-platform/
├── prisma/
│   ├── schema.prisma          # Database models
│   └── seed.ts                # Demo data seeder
├── src/
│   ├── app/
│   │   ├── (auth)/            # Login & Register
│   │   ├── (dashboard)/       # All 29 dashboard pages
│   │   │   ├── dashboard/     # Executive summary
│   │   │   ├── upload/        # CSV file upload
│   │   │   ├── drilldown/     # 6-level drill-down explorer
│   │   │   ├── episodes/      # Episode analytics
│   │   │   ├── admissions/    # Admission trends
│   │   │   ├── occupancy/     # Bed occupancy
│   │   │   ├── theatre/       # Theatre cases
│   │   │   ├── diagnoses/     # ICD/CPT analysis
│   │   │   ├── patients/      # Demographics
│   │   │   ├── casualty/      # Casualty transfers
│   │   │   ├── ward-beds/     # Ward bed fees
│   │   │   ├── revenue/       # Revenue analytics
│   │   │   ├── pharmacy/      # Pharmacy metrics
│   │   │   ├── debtors/       # Debtor aging
│   │   │   ├── claims/        # Claims (APAC/EDI)
│   │   │   ├── doctors/       # Doctor performance
│   │   │   ├── insights/      # AI-generated insights
│   │   │   ├── forecast/      # Holt-Winters forecasting
│   │   │   ├── correlations/  # Correlation matrix
│   │   │   ├── benchmarks/    # KPI benchmarks
│   │   │   ├── compare/       # Metric comparison
│   │   │   ├── year-compare/  # Year-on-year analysis
│   │   │   ├── stats-test/    # T-test, ANOVA, Chi-square
│   │   │   ├── ml-models/     # Naive Bayes, Logistic Reg
│   │   │   ├── clustering/    # K-means clustering
│   │   │   ├── automl/        # Automated ML pipeline
│   │   │   ├── data-qa/       # Data quality assessment
│   │   │   ├── data-robust/   # Robust statistics
│   │   │   └── search/        # Global search
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── ui/                # Button, Card, Input, Badge, Table, Tabs, Dialog, etc.
│   │   ├── charts/            # AreaChart, BarChart, LineChart, PieChart, ComboChart, StatCard
│   │   ├── dashboard/         # DataTable, KpiGrid, ChartCard, InsightCard
│   │   └── layout/            # Sidebar, Header, FilterBar
│   ├── lib/
│   │   ├── stats/             # Statistical & ML library (80+ functions)
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── parsers.ts         # CSV parsing utilities
│   │   ├── utils.ts           # Formatting, helpers
│   │   └── sample-data.ts     # Demo data generator
│   ├── store/                 # Zustand state management
│   └── types/                 # TypeScript interfaces
├── Dockerfile                 # Production multi-stage build
├── Dockerfile.dev             # Development with hot reload
├── docker-compose.yml         # Dev compose
└── docker-compose.prod.yml    # Prod compose (+ optional PostgreSQL, Nginx)
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create migration |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:seed` | Seed demo data |
| `npm run docker:dev` | Start with Docker (dev) |
| `npm run docker:prod` | Start with Docker (prod) |
| `npm run docker:down` | Stop Docker containers |

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:./dev.db` |
| `NEXTAUTH_SECRET` | JWT signing secret | (change in prod!) |
| `NEXTAUTH_URL` | App base URL | `http://localhost:3000` |

## Switching to PostgreSQL

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Update `.env`:
   ```
   DATABASE_URL="postgresql://user:pass@localhost:5432/avenues"
   ```

3. Uncomment the `postgres` service in `docker-compose.prod.yml`

4. Run `npx prisma migrate dev`

## Statistical Library

The built-in stats library (`src/lib/stats/`) includes:

- **Descriptive:** mean, median, mode, std dev, skewness, kurtosis, quartiles
- **Regression:** linear, polynomial, multi-variable
- **Time Series:** Holt-Winters, moving average, ACF, seasonal decomposition
- **Hypothesis Tests:** t-test, chi-square, ANOVA, Shapiro-Wilk, z-test
- **Correlation:** Pearson, Spearman, covariance matrix
- **Classification:** Naive Bayes, logistic regression, confusion matrix
- **Clustering:** K-means, elbow method, silhouette analysis
- **Matrix Ops:** multiplication, inversion, determinant

## License

Private — Avenues Clinic
