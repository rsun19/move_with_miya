-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('Scheduled', 'InProgress', 'Completed', 'Canceled');

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yoga_classes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "teacherIds" INTEGER[],
    "capacity" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ClassStatus" NOT NULL DEFAULT 'Scheduled',
    "locationId" INTEGER NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yoga_classes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "yoga_classes" ADD CONSTRAINT "yoga_classes_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
