# Layered Contact-Form Limiter with Exhaustive and E2E Testing

## Summary

Implement the Redis-backed layered limiter previously described:

- A generous IP circuit breaker for all contact POST attempts.
- A stricter per-browser quota for verified submissions.
- A dedicated anonymous HttpOnly cookie.
- Challenge tokens bound to that cookie.
- Redis-backed counters shared across restarts and backend instances.
- Fail-closed behavior when Redis is unavailable.

The implementation will include comprehensive unit, integration, and HTTP end-to-end coverage.

## Key Changes

- Add an injectable Redis client provider shared by sessions and rate limiting.
- Add atomic Redis-backed counters with TTLs:
  - 100 IP attempts per 10 minutes.
  - 3 verified submissions per anonymous cookie per hour.
- Issue a stable random `contact_visitor` HttpOnly cookie from the challenge endpoint.
- Bind challenge tokens to the cookie.
- Count malformed requests and failed challenges only against the IP circuit breaker.
- Count the browser quota only after challenge and Turnstile verification succeed.
- Preserve the existing public request and response shapes.
- Return `429`, `Retry-After`, and rate-limit headers when a limit is reached.
- Do not log raw IPs, cookies, CAPTCHA tokens, or message contents.
- Fail closed for submissions if Redis is unavailable.

## Exhaustive Test Coverage

Add unit and integration tests covering:

- Redis key isolation between IPs, cookies, and endpoints.
- Atomic increment behavior under concurrent requests.
- Counter expiration and exact boundary behavior.
- Redis connection failures and fail-closed behavior.
- Cookie generation, stability, expiration, and security attributes.
- Challenge-token binding to the correct cookie.
- Missing, malformed, expired, and copied challenge tokens.
- IP limits at one request below, exactly at, and one request above the threshold.
- Browser limits at one submission below, exactly at, and one submission above the threshold.
- Failed body validation, failed challenge validation, and failed CAPTCHA verification.
- Confirmation that failed validation does not consume the browser submission quota.
- Confirmation that blocked requests do not persist submissions or send notifications.
- Multiple cookies sharing one IP.
- One cookie using multiple IPs.
- Cookie deletion or replacement while the IP circuit breaker remains effective.
- Correct `429`, `Retry-After`, remaining, and reset headers.
- Existing contact persistence, notification, admin retrieval, and CAPTCHA behavior.

## End-to-End Tests

Extend the existing backend E2E suite with HTTP-level tests using Supertest:

- `GET /contact/challenge` returns a token and sets the anonymous cookie.
- Repeated challenge requests preserve the same cookie.
- A normal browser flow can obtain a challenge and submit successfully.
- Two separate Supertest agents sharing the same forwarded IP have independent browser quotas.
- The same agent is blocked after three verified submissions.
- A different agent can still submit from that IP until the IP circuit breaker is reached.
- Invalid rapid requests eventually trigger the IP limit.
- A copied challenge with another agent's cookie is rejected.
- Blocked requests return the correct status and headers.
- A second Nest application instance sees the same Redis counters.
- Redis outage causes contact submission to fail closed.
- Persistence and notification mocks confirm no side effects occur after rejection.

E2E tests should use a dedicated Redis test namespace or flushed test database, small test-specific TTLs, and isolated mocks for RabbitMQ, Turnstile, email delivery, and persistence. They must exercise the real HTTP middleware, cookie handling, guards/services, controller flow, and Redis counter behavior.

## Verification

Run all existing and new checks:

```bash
npm test --prefix backend -- --runInBand
npm run test:e2e --prefix backend
npm run typecheck --prefix backend
npm run build --prefix backend
```

The test suite should pass without requiring live Cloudflare, Resend, RabbitMQ, or production services.

## Assumptions

- The balanced limits remain the defaults: 100 IP attempts per 10 minutes and 3 verified submissions per browser per hour.
- Redis is the required production dependency for rate-limit state.
- The existing frontend cookie behavior continues to work through `credentials: 'include'`.
- Browser fingerprinting and ML-style scoring remain out of scope until operational data shows deterministic layered limits are insufficient.
- E2E means full application HTTP-flow testing with real Redis, while external providers are replaced with deterministic test doubles.
