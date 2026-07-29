/*
  Warnings:

  - You are about to drop the column `isTeacher` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER', 'VIEWER', 'TEACHER');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN     "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

-- Backfill existing teachers
UPDATE "User" SET "role" = 'TEACHER' WHERE "isTeacher" = true;

-- Drop old column
ALTER TABLE "User" DROP COLUMN "isTeacher";
