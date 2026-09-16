# Plan 1: Paid Registration and Stripe Checkout

## Goal

Allow a member to register for a paid class only after Stripe confirms payment, while keeping free-class registration unchanged. The flow must be safe against duplicate clicks, repeated webhook delivery, stale class prices, canceled checkouts, and refunds.

## Current state

- `YogaClass` has a `cost` field, but no Stripe identifiers or payment records.
- Both the class detail page and the class modal currently call the free-registration endpoint directly.
- The registration service already enforces capacity and uniqueness for active registrations.
- Stripe dependencies, endpoints, webhook handling, and success/cancel pages do not exist yet.

Relevant files:

- `classes-service/prisma/schema.prisma`
- `registration-service/prisma/schema.prisma`
- `backend/src/externalControllers/RegistrationController.ts`
- `frontend/src/components/ClassDetailClient.tsx`
- `frontend/src/components/ClassModal.tsx`

## Design decisions

1. The backend is authoritative for class eligibility, price, capacity, user identity, and payment state. The browser sends only `classId`.
2. Free classes continue to use the existing registration endpoint.
3. Paid classes use Stripe Checkout in hosted mode.
4. Stripe webhooks, rather than the browser redirect, finalize registration.
5. Webhook processing is idempotent. A checkout session may be delivered more than once.
6. Store money as integer cents and an explicit currency in the payment record. Convert the class `Decimal` to cents on the server and reject invalid precision or negative values.
7. Use a persistent Stripe Price ID only if the studio wants Stripe-managed catalog prices. Otherwise, create a one-time `price_data` line item from the database amount at checkout time. Do not accept an amount from the client.

## Data model changes

### Classes service

- Decide whether the studio will use Stripe-managed prices.
- If yes, add nullable `stripePriceId` and maintain it when an admin creates or changes a paid class.
- If no, leave the class schema price-based and create Checkout `price_data` from `cost`.
- Add validation preventing a class from being marked paid without a valid non-zero cost.

### Registration service

Add a `Payment` model, or equivalent payment fields, containing:

- `id`
- `userId`
- `classId`
- `stripeCheckoutSessionId` (unique)
- `stripePaymentIntentId` (nullable, unique when present)
- `amountCents`
- `currency`
- `status`: `Pending`, `Paid`, `Failed`, `Expired`, `Refunded`
- `registrationId` (nullable)
- `createdAt`, `updatedAt`, `paidAt`, `refundedAt`

Add indexes for `(userId, classId)` and payment status. Add a uniqueness rule preventing more than one active paid registration for the same user and class.

## Backend implementation

### Configuration

Add and validate:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY` only if the frontend needs it; Checkout redirect does not require it
- `STRIPE_CURRENCY` with a documented default
- `PUBLIC_APP_URL` for success and cancel URLs

Install the Stripe server SDK in `backend` and keep the secret key server-side.

### Checkout endpoint

Create `POST /checkout/create-session` guarded by the authenticated session.

Implementation sequence:

1. Read the session user ID and `classId`.
2. Fetch the class from the classes service.
3. Re-run the same checks as free registration: class exists, is open, not ended/canceled/completed, user is not banned, private-class requirements are satisfied, and capacity is available or a documented pending-payment reservation policy applies.
4. Check for an existing active registration or an existing usable pending Checkout session.
5. Calculate the amount from the class record and convert it to cents.
6. Create or reuse a pending payment record.
7. Create a Stripe Checkout session with:
   - one class line item;
   - `mode: payment`;
   - `client_reference_id` set to the payment ID;
   - metadata containing only the payment ID, class ID, and user ID;
   - success and cancel URLs containing the Checkout session ID, not authorization data.
8. Return the hosted Checkout URL and payment ID.

Use an idempotency key derived from the authenticated user, class, and pending payment ID when creating the Stripe session.

### Webhook endpoint

Create `POST /checkout/webhook` before JSON parsing or provide a raw-body route so Stripe signatures can be verified against the exact request bytes.

Handle at least:

- `checkout.session.completed`: verify the session is paid, load the payment by metadata, confirm the amount/currency, mark payment paid, and create or restore the registration.
- `checkout.session.async_payment_succeeded`: process the same success path for delayed payment methods.
- `checkout.session.async_payment_failed`: mark the payment failed.
- `checkout.session.expired`: mark the payment expired.
- `charge.refunded` or the selected refund event: mark the payment refunded and update registration state according to the cancellation policy.

The success handler must be transactional within the registration service and safe to run repeatedly. A duplicate webhook must return success without creating a second registration.

### Registration service RPCs

Add message patterns for:

- create/update pending payment;
- find payment by Checkout session or payment ID;
- finalize a paid registration idempotently;
- mark payment failed/expired/refunded.

Do not let the frontend call an RPC or endpoint that can mark a payment paid.

## Frontend implementation

1. Add a shared `RegisterButton` decision path used by both the class detail page and class modal.
2. If `cost === 0`, call the existing free-registration flow.
3. If `cost > 0`, call `POST /api/checkout/create-session`, then set `window.location.href` to the returned Stripe URL.
4. Remove the current direct free-registration call for paid classes.
5. Add `/checkout/success` and `/checkout/cancel` pages.
6. On success, display “Payment received; confirming registration” and poll a safe payment-status endpoint or refresh the user’s registrations. Do not treat the redirect alone as proof of payment.
7. On cancel, leave the class unregistered and provide a retry action.
8. Disable the button while the request is in flight and show meaningful errors for full, closed, banned, or unavailable classes.

## Cancellation and refund integration

Coordinate with [Plan 2](../2/plan.md):

- A paid registration cancellation must either issue a Stripe refund or clearly state that refunds are handled manually.
- Refunds must be idempotent and recorded.
- A class cancellation must identify all paid registrations and execute the documented refund/notification process.

## Testing

### Unit tests

- Amount conversion and currency validation.
- Paid versus free registration routing.
- Checkout session metadata and line-item construction.
- Existing-registration and duplicate-session handling.
- Webhook signature rejection.
- Each supported webhook event.
- Repeated success webhook does not duplicate a registration.
- Tampered class ID, user ID, amount, or currency is rejected.

### HTTP/integration tests

- Authenticated member can create a paid Checkout session.
- Anonymous, banned, and unauthorized users cannot.
- Paid class never reaches the free-registration path.
- Webhook finalizes registration only after verified payment.
- Session success redirect before webhook does not show the user as registered.
- Refund/cancellation updates both payment and registration state.

Use Stripe test doubles or Stripe test mode; do not require live Stripe credentials in CI.

## Acceptance criteria

- A paid class cannot be registered through either frontend entry point without a successful Stripe payment.
- Free classes still work exactly as before.
- Stripe webhook processing is signature-verified, idempotent, and observable.
- Amounts are derived from the database, not the browser.
- Duplicate clicks and duplicate webhook deliveries do not create duplicate registrations or charges.
- Payment, registration, cancellation, and refund states are visible to administrators.

