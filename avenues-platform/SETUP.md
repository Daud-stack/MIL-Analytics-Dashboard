# Avenues Clinic Intelligence Platform - Setup Guide

## Foundation Files Created

This document describes the foundation files that have been created for the Avenues Clinic Intelligence Platform.

### Database Layer

#### `prisma/schema.prisma`
- Full Prisma schema with SQLite datasource
- Models:
  - **User**: Authentication and role management (ADMIN, ANALYST, VIEWER)
  - **Organization**: Multi-tenant organization support
  - **UserOrganization**: Many-to-many relationship for users and organizations
  - **DataUpload**: Track file uploads (DASHBOARD, LOCATION, CLAIMS types)
  - **DashboardData**: Monthly dashboard metrics and KPIs
  - **DoctorData**: Doctor performance and metrics
  - **ClaimsData**: Insurance claims tracking and analytics

### Type Definitions

#### `src/types/index.ts`
Core TypeScript interfaces and types:
- **DashboardMetrics**: Revenue, episodes, admissions, theater, pharmacy, occupancy data
- **LocationData**: Location-level analytics
- **ClaimsMetrics**: Claims tracking and analysis
- **YearData**: Annual data aggregation
- **User & SessionUser**: Authentication types
- **FilterState**: Analytics filter configuration
- **ChartConfig**: Reusable chart configuration
- **StorageState**: Zustand store types
- Constants: MONTHS, BENCHMARKS, COLOR_PALETTE

### Utility Functions

#### `src/lib/utils.ts`
Production-quality utility functions:
- **Class utilities**: `cn()` for Tailwind merging
- **Formatting**: `formatCurrency()`, `formatNumber()`, `formatPercent()`, `formatDate()`, `formatTime()`
- **Calculations**: `calculateYoY()`, `percentChange()`, `round()`
- **Array operations**: `sum()`, `average()`, `getMin()`, `getMax()`
- **Data export**: `generateCSV()`, `downloadCSV()`
- **Performance**: `debounce()`, `throttle()`
- **Data handling**: `deepClone()`, `parseJSON()`, `isEmpty()`
- **Misc**: `truncate()`, `generateId()`, `isValidUrl()`, `formatBytes()`, `sleep()`

### State Management

#### `src/store/index.ts`
Zustand store with persistence:
- **State**: years, currentYear, currentMonth, compareYears, activePage, theme, sidebarOpen, filters
- **Actions**: setYear, setMonth, addYearData, removeYear, toggleCompare, setTheme, toggleSidebar, setFilters
- **Selectors**: Custom hooks for optimal performance
- **Persistence**: localStorage with custom serialization for Map
- **Version Control**: Store versioning for future migrations

### Authentication

#### `src/lib/auth.ts`
NextAuth v5 configuration:
- Credentials provider (email/password)
- JWT session strategy
- Custom callbacks for token and session management
- Placeholder implementation with TODO comments for database integration
- Type augmentation for next-auth

#### `src/auth.ts`
Main NextAuth handler export for API routes and middleware

### Middleware

#### `src/middleware.ts`
Route protection:
- Protected routes: /dashboard, /analytics, /reports, /settings, /admin
- Redirects unauthenticated users to login
- Prevents authenticated users from accessing auth pages
- Excludes API routes and static files from middleware

### Configuration

#### `next.config.ts`
Next.js configuration with:
- React strict mode
- Image optimization
- Environment variables
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Redirects and rewrites configuration
- Performance optimizations (compression, no powered-by header)

#### `tailwind.config.ts`
Tailwind CSS configuration:
- Extended color palette (navy, teal, amber, rose, violet)
- Custom spacing scale
- Border radius configurations
- Box shadow utilities
- Custom keyframes and animations
- Dark mode support

#### `src/app/globals.css`
Global styles and CSS variables:
- Theme system with CSS custom properties
- Light and dark mode support
- Typography defaults
- Form styling
- Custom scrollbar
- Component utility classes (.card, .btn, .badge, etc.)
- Animation keyframes
- Print styles

#### `.env.example`
Environment variable template:
- Application settings
- Database configuration
- NextAuth configuration
- API configuration
- Optional external services

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Database
```bash
# Create .env.local from .env.example
cp .env.example .env.local

# Run Prisma migration
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate
```

### 3. Configure Environment Variables
Edit `.env.local` with your settings:
```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Access Application
Open [http://localhost:3000](http://localhost:3000) in your browser

**Default Credentials** (dev only):
- Email: admin@avenues.clinic
- Password: admin

## Next Steps

### Authentication Integration
1. Update `src/lib/auth.ts` to integrate with Prisma
2. Implement password hashing (bcrypt)
3. Add user registration flow
4. Implement SSO if needed

### Database Integration
1. Set up database connection pooling for production
2. Add database seeding scripts
3. Create migration files for future schema changes

### API Routes
1. Create `/src/app/api` endpoints for:
   - Authentication (sign in, sign out, register)
   - Data uploads
   - Dashboard metrics
   - Analytics queries

### Dashboard Components
1. Create React components for:
   - Dashboard layout
   - Charts and visualizations
   - Data tables
   - Filters and controls
   - Analytics reports

### Testing
1. Set up Jest for unit tests
2. Add integration tests for API
3. Create E2E tests with Playwright

## File Structure
```
src/
├── app/
│   ├── globals.css           # Global styles
│   └── ...                   # Page components
├── auth.ts                   # NextAuth handler
├── middleware.ts             # Route protection
├── lib/
│   ├── auth.ts              # Auth config
│   └── utils.ts             # Utility functions
├── store/
│   └── index.ts             # Zustand store
└── types/
    └── index.ts             # TypeScript definitions
prisma/
└── schema.prisma            # Database schema
```

## Key Technologies

- **Frontend**: Next.js, React, TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Authentication**: NextAuth v5
- **Database**: SQLite (Prisma ORM)
- **Data Export**: CSV generation

## Development Tips

1. **Type Safety**: Always use TypeScript interfaces from `src/types/index.ts`
2. **Styling**: Use Tailwind classes and CSS variables from `globals.css`
3. **Store**: Use selector hooks (e.g., `useCurrentYear()`) for optimal performance
4. **Utilities**: Import formatting functions from `src/lib/utils.ts`
5. **Environment**: Keep sensitive data in `.env.local` and out of version control

## Production Checklist

- [ ] Update `NEXTAUTH_SECRET` with a strong random value
- [ ] Configure `NEXTAUTH_URL` for production domain
- [ ] Set up production database
- [ ] Enable HTTPS
- [ ] Configure CORS headers if needed
- [ ] Set up error logging and monitoring
- [ ] Configure backup strategies
- [ ] Review security headers
- [ ] Test authentication flows
- [ ] Load test database queries
