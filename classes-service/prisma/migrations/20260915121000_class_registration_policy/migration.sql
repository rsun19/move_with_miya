ALTER TABLE "yoga_classes"
  ADD COLUMN "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cancellationCutoffHours" INTEGER NOT NULL DEFAULT 24;
