# Remaining Steps

## 1. Create database tables (Prisma migrations)

**Done.** All three services have migrations applied to Docker Postgres (`miya` user, `miya:miya` password).

## 2. Start all services

```bash
docker compose up
```

## 3. Test the auth flow

1. Go to `http://localhost:5173`
2. Sign in with Google
3. User should be persisted in `miya_users` database
4. Check dashboard displays user info

---

## Yoga Experience on First Private Class

### How it works (user flow)

1. User browses classes and taps "Register" on a private class
2. Frontend checks `user.yogaExperience` (returned by `GET /api/auth/me`)
3. If `null`/empty → frontend shows a textarea modal: *"Tell us about your yoga experience"*
4. User fills it in → frontend calls `PATCH /api/users/:id` with `{ yogaExperience }` (proxied by nginx to user-service)
5. Frontend then calls `POST /api/registration/:classId/:userId` to complete registration
6. On subsequent private class registrations, `yogaExperience` is already set → form is skipped

### Server-side changes (already implemented)

| File | Change |
|---|---|
| `user-service/prisma/schema.prisma` | Added `yogaExperience String?` to `User` model |
| `user-service/src/users/dto/create-user.dto.ts` | Added optional `yogaExperience` field |
| `user-service/src/users/dto/update-user.dto.ts` | Added optional `yogaExperience` field |
| `nginx/nginx.conf` | Added `/api/users/` → user-service proxy route |

> `yogaExperience` is included in the schema and will be picked up automatically when running `prisma migrate dev --name init` (step 1 above). No separate migration needed.

### Frontend implementation (TODO)

- [ ] Add `yogaExperience?: string` to `AuthUser` in `frontend/src/lib/auth.tsx`
- [ ] Create registration flow that checks `user.yogaExperience` before submitting
- [ ] Show yoga experience textarea modal when field is empty for private class registration
- [ ] Handle validation errors from the server

---

## 4. Next features to consider

- Admin/teacher role management
- Class creation UI (currently only mock endpoints exist)
- Registration/booking flow
- Waitlist management
