# Implementation Plan

## Architecture Decisions

| Decision | Choice |
|----------|--------|
| **UI Library** | MUI-only — remove Tailwind, rewrite all pages with MUI `sx`/`styled`/theme |
| **SEO** | Maximize SSR: server components for data fetching + `generateMetadata`, client boundaries only where MUI interactivity requires it. Next.js SSR renders client components server-side on initial load anyway. |
| **Payments** | Stripe Checkout (hosted redirect) — last priority |
| **Contact Form** | Store submissions in DB + send email via Resend |
| **Admin Roles** | `UserRole` enum (`ADMIN`, `MEMBER`, `VIEWER`, `TEACHER`) |
| **Class Model** | Add `cost` (Decimal), `description` (String), `duration` (Int), `imageUrl` (String?) |



---

## Status

- **Prisma migrations** — Done (yogaExperience on User, all three service tables)
- **Auth flow** — Need to verify (start services, test Google sign-in)

---

## Phase 1: Backend Schema Changes

### user-service (`user-service/prisma/schema.prisma`)
- Add `role` field using `UserRole` enum (`ADMIN`, `MEMBER`, `VIEWER`, `TEACHER`)
- Add `banned` (`Boolean @default(false)`) to `User` model
- Update DTOs (`create-user.dto.ts`, `update-user.dto.ts`) with `role` and `banned`
- Run migration

### classes-service (`classes-service/prisma/schema.prisma`)
- Add `cost` (`Decimal`)
- Add `description` (`String`)
- Add `duration` (`Int`)
- Add `imageUrl` (`String?`)
- Run migration

### registration-service (`registration-service/prisma/schema.prisma`)
- Add `ContactSubmission` model: `id`, `name`, `email`, `subject`, `message`, `createdAt`
- Run migration

---

## Phase 2: Backend Endpoint Changes

### user-service
- Expose `role` in `GET /auth/me` response
- Create `AdminGuard` (checks session.userId → DB role)
- Add `PATCH /users/:id/role` (admin-only, requires `AdminGuard`)
- Add `PATCH /users/:id/ban` (admin-only, toggles `banned`)

### backend (API Gateway)
- Wire `AdminGuard` to existing class/registration CRUD endpoints
- Add `POST /api/contact` — stores `ContactSubmission` via RabbitMQ + sends email via Resend
- Add `GET /api/contact` — admin-only, lists submissions

### registration-service
- Handle new RabbitMQ cmds: `create_contact_submission`, `get_contact_submissions`

---

## Phase 3: Frontend Foundation

### Setup
- Uninstall Tailwind (`tailwindcss`, `@tailwindcss/postcss`, `postcss.config.mjs`)
- Install `@mui/material`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`, `@mui/x-date-pickers`, `date-fns`
- Delete/rewrite `globals.css` — MUI baseline only
- Remove `postcss.config.mjs`

### New files

| File | Purpose |
|------|---------|
| `src/lib/theme.ts` | MUI theme (brand colors, typography) |
| `src/components/ThemeRegistry.tsx` | Client component wrapping `ThemeProvider` + `CssBaseline` |
| `src/components/Navbar.tsx` | App bar with nav links, responsive menu |
| `src/components/Footer.tsx` | Footer |

### Modified files

| File | Changes |
|------|---------|
| `src/app/layout.tsx` | Remove Tailwind classes, wrap with `ThemeRegistry` |
| `src/app/page.tsx` | Rewrite with MUI (placeholder for Phase 4 class browser) |
| `src/app/login/page.tsx` | Rewrite with MUI |
| `src/app/dashboard/page.tsx` | Rewrite with MUI (placeholder for Phase 6 profile) |
| `src/app/(protected)/layout.tsx` | Rewrite with MUI |
| `src/lib/auth.tsx` | Add `role: UserRole`, `yogaExperience?: string`, `banned?: boolean` to `AuthUser` |

---

## Phase 4: Class Browser (Home Page)

### Components

| Component | Description |
|-----------|-------------|
| `CalendarView` | MUI DateCalendar showing classes on dates |
| `ListView` | MUI Table/List of classes with sort/filter |
| `ClassCard` | MUI Card: name, time, location, capacity, price, public/private badge |
| `ViewToggle` | Toggle button group (Calendar ↔ List) |
| `ClassModal` | MUI Dialog: summary + "View More" + "Register" |
| `FilterBar` | Filter by public/private, date range, location |

### Data flow
- Home page (`/`) — can be server component fetching `GET /api/classes`
- Pass data to client component for interactive calendar/list

---

## Phase 5: Class Detail Page (`/classes/[id]`)

### SSR
- `generateMetadata` — dynamic SEO title/description from class data
- Async server component fetches class + registrations count

### Client Components

| Component | Description |
|-----------|-------------|
| `ClassDetail` | Full info: image, description, duration, location, instructor, price |
| `ParticipantsList` | Public classes: registered count / capacity |
| `YogaExperienceForm` | Private classes: MUI Dialog textarea if `user.yogaExperience` is empty |
| `RegisterButton` | Initiates registration (free) or Stripe Checkout (paid, Phase 9) |

### Registration Flow
1. User clicks "Register"
2. If private class AND `user.yogaExperience` is empty → show yoga experience dialog
3. Submit experience → `PATCH /api/users/:id` → proceed
4. If class has `cost` → Stripe Checkout (Phase 9)
5. If free → `POST /api/registration/class/:classId/user/:userId`

---

## Phase 6: User Profile (`/dashboard`)

### Components

| Component | Description |
|-----------|-------------|
| `ProfileForm` | MUI TextFields: firstName, lastName, preferredName, phoneNumber, yogaExperience |
| `RoleBadge` | Display role tag if admin/teacher |

### Data flow
- Load user data from `useAuth().user`
- Save → `PATCH /api/users/:id`

---

## Phase 7: Contact Form

### Page & Components
- `src/app/contact/page.tsx` — SSR page with metadata
- `ContactForm` — MUI TextFields (name, email, subject, message) + validation + submit

### Data flow
- Submit → `POST /api/contact` → stores in `ContactSubmission` table + Resend email to studio owner

---

## Phase 8: Admin Dashboard (`/admin`)

### Guard
- `useAuth()` → check `user.role === 'ADMIN'`, redirect to `/` if not

### Sections (tabs)

| Tab | Component | Description |
|-----|-----------|-------------|
| Classes | `ClassManager` | MUI DataGrid: list, create, edit, delete classes |
| Users | `UserManager` | Table: list users, change role dropdown, ban/unban toggle |
| Registrations | `RegistrationViewer` | Table: all registrations, filter by class/date |
| Contact Submissions | `ContactSubmissions` | Table: submitted forms, read/unread status |

---

## Phase 9: Payments (Stripe) — LAST

### Backend
- Add `stripePriceId` (`String?`) to `YogaClass` if not already added in Phase 1
- New `StripeController`:
  - `POST /api/checkout/create-session` — creates Stripe Checkout Session with class line item, `classId` + `userId` in metadata
  - `POST /api/checkout/webhook` — on `checkout.session.completed`, confirm registration

### Frontend
- `StripeCheckoutButton` — calls create-session, redirects to Stripe
- Handle success/cancel redirects

---

## File Map

```text
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                         # MODIFY
│   │   ├── page.tsx                           # REWRITE (class browser)
│   │   ├── globals.css                        # REWRITE
│   │   ├── classes/[id]/page.tsx              # NEW
│   │   ├── contact/page.tsx                   # NEW
│   │   ├── admin/page.tsx                     # NEW
│   │   ├── login/page.tsx                     # REWRITE
│   │   ├── dashboard/page.tsx                 # REWRITE
│   │   └── (protected)/layout.tsx             # REWRITE
│   ├── lib/
│   │   ├── auth.tsx                           # MODIFY
│   │   ├── theme.ts                           # NEW
│   │   └── api.ts                             # KEEP
│   └── components/
│       ├── ThemeRegistry.tsx                  # NEW
│       ├── Navbar.tsx                         # NEW
│       ├── Footer.tsx                         # NEW
│       ├── ClassCard.tsx                      # NEW (Phase 4)
│       ├── ClassModal.tsx                     # NEW (Phase 4)
│       ├── CalendarView.tsx                   # NEW (Phase 4)
│       ├── ListView.tsx                       # NEW (Phase 4)
│       ├── YogaExperienceForm.tsx             # NEW (Phase 5)
│       ├── ProfileForm.tsx                    # NEW (Phase 6)
│       ├── ContactForm.tsx                    # NEW (Phase 7)
│       └── admin/
│           ├── ClassManager.tsx              # NEW (Phase 8)
│           ├── UserManager.tsx               # NEW (Phase 8)
│           ├── RegistrationViewer.tsx         # NEW (Phase 8)
│           └── ContactSubmissions.tsx         # NEW (Phase 8)
```
