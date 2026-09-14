-- Track whether an administrator has reviewed a contact submission.
ALTER TABLE "ContactSubmission"
ADD COLUMN "read" BOOLEAN NOT NULL DEFAULT false;
