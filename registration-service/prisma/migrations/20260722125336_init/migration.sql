-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('Registered', 'Waitlisted', 'Canceled');

-- CreateTable
CREATE TABLE "Registration" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'Registered',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);
