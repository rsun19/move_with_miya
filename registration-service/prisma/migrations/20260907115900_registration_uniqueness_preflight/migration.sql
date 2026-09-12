-- Fail before the concurrent unique index migration when duplicate rows need
-- to be reconciled manually.
DO $$
DECLARE
  duplicate_groups bigint;
BEGIN
  SELECT COUNT(*) INTO duplicate_groups
  FROM (
    SELECT "classId", "userId"
    FROM "Registration"
    GROUP BY "classId", "userId"
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'Cannot create Registration_classId_userId_key: %s duplicate class/user group(s) found.',
        duplicate_groups
      ),
      HINT = 'Reconcile duplicate rows in "Registration" so each classId/userId pair occurs once, then rerun prisma migrate deploy.';
  END IF;
END
$$;
