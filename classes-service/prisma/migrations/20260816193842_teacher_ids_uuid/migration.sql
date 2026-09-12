-- AlterTable
ALTER TABLE "yoga_classes" ALTER COLUMN "teacherIds" SET DATA TYPE TEXT[] USING "teacherIds"::TEXT[];
