-- AlterTable
ALTER TABLE "yoga_classes" ADD COLUMN     "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "duration" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "imageUrl" TEXT;
