-- This migration intentionally contains one statement so Prisma can execute
-- the PostgreSQL concurrent index build outside a transaction.
CREATE UNIQUE INDEX CONCURRENTLY "Registration_classId_userId_key"
ON "Registration"("classId", "userId");
