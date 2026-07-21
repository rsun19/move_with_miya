# Remaining Steps

## 1. Create database tables (Prisma migrations)

Start PostgreSQL, then run migrations in each service:

```bash
# Start dependencies
docker compose up -d postgres

# user-service
cd user-service
DATABASE_URL=postgresql://miya:miya@localhost:5432/miya_users npx prisma migrate dev --name init

# classes-service
cd ../classes-service
DATABASE_URL=postgresql://miya:miya@localhost:5432/miya_classes npx prisma migrate dev --name init

# registration-service
cd ../registration-service
DATABASE_URL=postgresql://miya:miya@localhost:5432/miya_registrations npx prisma migrate dev --name init
```

## 2. Start all services

```bash
docker compose up
```

## 3. Test the auth flow

1. Go to `http://localhost:5173`
2. Sign in with Google
3. User should be persisted in `miya_users` database
4. Check dashboard displays user info

## 4. Next features to consider

- Admin/teacher role management
- Class creation UI (currently only mock endpoints exist)
- Registration/booking flow
- Waitlist management
