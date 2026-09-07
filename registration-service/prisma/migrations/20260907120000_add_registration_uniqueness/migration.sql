-- Prevent duplicate active or historical registrations for the same class/user.
CREATE UNIQUE INDEX "Registration_classId_userId_key"
ON "Registration"("classId", "userId");
