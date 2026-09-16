# Plan 2: Registration Business Rules and Lifecycle

## Goal

Complete the registration lifecycle around capacity, waitlists, cancellation, historical records, class deletion/cancellation, notifications, and paid-registration coordination.

## Current state

- `RegistrationStatus` includes `Registered`, `Waitlisted`, and `Canceled`.
- Full classes currently reject new registrations instead of waitlisting members.
- Member cancellation deletes the registration row.
- Admin cancellation also deletes the row.
- Classes and registrations use separate databases, so deleting a class does not automatically clean up its registrations.
- There are no registration confirmation, waitlist, cancellation, reminder, or class-cancellation notifications.

Relevant files:

- `registration-service/prisma/schema.prisma`
- `registration-service/src/registration.service.ts`
- `backend/src/externalControllers/RegistrationController.ts`
- `classes-service/src/classes.service.ts`
- `frontend/src/components/ClassDetailClient.tsx`
- `frontend/src/components/admin/AdminDashboard.tsx`

## Design decisions

1. Keep registration rows as historical records; cancellation changes status to `Canceled` rather than deleting data.
2. Count only `Registered` rows toward capacity.
3. When capacity is full, create a `Waitlisted` row unless the studio explicitly disables waitlisting for that class.
4. Promote the earliest eligible waitlisted member when a registered seat becomes available.
5. Define a cancellation cutoff in one place and enforce it on the server.
6. Prefer soft-canceling classes over deleting classes once registrations exist.
7. Use an outbox/event pattern for notifications so a database write is not reported as successful while its event is lost.

## Data model changes

Extend `Registration` with:

- `canceledAt` (nullable)
- `waitlistedAt` (nullable)
- `promotedAt` (nullable)
- `cancellationReason` (nullable)
- `source` or `createdBy` if administrators need to distinguish member, admin, and webhook actions

Add indexes for:

- `(classId, status, registeredAt)`
- `(classId, status, waitlistedAt)`
- `(userId, status)`

Add a class-level setting or documented default for:

- whether waitlisting is enabled;
- cancellation cutoff in hours before class start;
- whether paid cancellations are refundable.

If notification delivery is implemented in this service, add an `OutboxEvent` model containing event type, aggregate ID, payload, attempts, next attempt time, and processed time.

## Registration creation

Update `createRegistration` to run a serializable transaction with the following behavior:

1. Find the existing row for `(classId, userId)`.
2. If it is already `Registered`, return a conflict.
3. If it is `Waitlisted`, return a conflict or the existing waitlist record.
4. If it is `Canceled`, allow re-entry if the class is still open.
5. Count only active `Registered` rows.
6. Create `Registered` when a seat is available.
7. Create `Waitlisted` when the class is full and waitlisting is enabled.
8. Preserve the unique `(classId, userId)` rule by updating the canceled row instead of inserting a duplicate.
9. Emit a registration-created or waitlisted event after the transaction commits.

The gateway must continue to validate class status, end time, user ban state, and private-class eligibility before calling the service. The registration service must still validate capacity and uniqueness because the gateway check is not sufficient under concurrency.

## Waitlist promotion

Add a transaction-safe promotion method:

1. Lock or otherwise serialize promotion for the class.
2. Count active registrations.
3. While seats remain, select the earliest `Waitlisted` row by `waitlistedAt`, then ID.
4. Change it to `Registered`, set `promotedAt`, and update its timestamp.
5. Emit a promotion event for each promoted member.

Run promotion when:

- a member cancels;
- an administrator cancels a registration;
- a paid payment expires or is refunded and releases a seat;
- an administrator increases class capacity;
- a class is reopened.

The promotion operation must be idempotent and safe when two cancellations happen concurrently.

## Cancellation behavior

Replace member and admin deletion with status transitions:

- Member cancellation: verify ownership, class policy, and cutoff; set `Canceled` and `canceledAt`.
- Admin cancellation: allow cancellation with an audit reason; set `Canceled` and `canceledAt`.
- Repeated cancellation: return the existing canceled state without changing history.
- Cancellation after the cutoff: reject or require an admin override, according to the policy.

The API should return the resulting registration status. The UI should display registered, waitlisted, canceled, and refund-pending states separately.

## Class lifecycle and data consistency

### Class cancellation

Add an admin class-cancel action that:

1. Changes the class status to `Canceled`.
2. Retrieves active registrations from the registration service.
3. Cancels or marks them `ClassCanceled` if a separate status is preferred.
4. Starts refunds for paid registrations according to [Plan 1](../1/plan.md).
5. Emits notifications to affected members.

### Class deletion

Prefer disabling deletion when registrations or payments exist. If deletion is required:

1. Resolve all registrations and payments first.
2. Cancel/refund and preserve the history.
3. Delete only after the dependent records are safely handled.

Add an integration test proving that deleting or canceling a class cannot leave silently orphaned active registrations.

## Notifications

Define event types and templates for:

- registration confirmed;
- waitlisted;
- promoted from waitlist;
- member cancellation;
- class canceled;
- class time/location changed;
- payment received/refund issued.

Use an outbox or durable RabbitMQ event flow. Include a delivery status and retry policy. Avoid sending duplicate confirmation emails when a webhook or promotion is retried.

Add a reminder job for upcoming classes only after the event flow is reliable. The job should use a persistent send record or event key so restarts do not duplicate reminders.

## API and frontend changes

Add or update endpoints for:

- member registration status;
- member cancellation;
- admin cancellation with reason;
- class waitlist/registration list;
- payment/refund state;
- class cancellation.

Update class cards, class detail, dashboard, and admin tables to show:

- seats remaining;
- waitlist position where appropriate;
- cancellation/refund state;
- clear next actions for the member.

Do not expose private yoga-experience data in public class or registration responses.

## Testing

### Unit tests

- Available seat creates `Registered`.
- Full class creates `Waitlisted`.
- Existing registered/waitlisted/canceled rows behave correctly.
- Only registered rows count toward capacity.
- Earliest waitlisted member is promoted.
- Two concurrent cancellations produce no duplicate promotion.
- Cancellation cutoff and admin override rules.
- Repeated cancellation/promotion is idempotent.

### Integration and E2E tests

- Full-class browser flow shows waitlist state.
- Cancellation promotes the next member.
- Canceled rows remain queryable for admin history.
- Class cancellation updates all active registrations.
- A class with registrations cannot be hard-deleted without lifecycle handling.
- Notification events are emitted once and retried after transient failure.
- Paid cancellation and refund state agree with the payment workflow.

## Acceptance criteria

- Capacity never exceeds the configured limit.
- Members can join and leave a waitlist with deterministic ordering.
- Cancellations preserve history and trigger promotion where applicable.
- Class cancellation/deletion cannot strand active registrations or paid payments.
- Registration and lifecycle notifications are durable, retryable, and non-duplicating.
- The UI accurately represents every registration state.

