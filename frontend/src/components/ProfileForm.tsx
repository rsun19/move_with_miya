'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { api } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

type ProfileFields = Pick<
  AuthUser,
  'firstName' | 'lastName' | 'preferredName' | 'phoneNumber' | 'yogaExperience'
>;

function fieldsFromUser(user: AuthUser): ProfileFields {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName ?? '',
    phoneNumber: user.phoneNumber ?? '',
    yogaExperience: user.yogaExperience ?? '',
  };
}

export default function ProfileForm({
  user,
  onSaved,
}: {
  user: AuthUser;
  onSaved?: (user: AuthUser) => void;
}) {
  const [fields, setFields] = useState<ProfileFields>(() =>
    fieldsFromUser(user),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const updateField = (field: keyof ProfileFields, value: string) => {
    setFields((previous) => ({ ...previous, [field]: value }));
    setSaved(false);
    setError(null);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstName = fields.firstName.trim();
    const lastName = fields.lastName.trim();
    if (!firstName || !lastName) {
      setError('First name and last name are required.');
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api<AuthUser>(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName,
          lastName,
          preferredName: fields.preferredName?.trim() || null,
          phoneNumber: fields.phoneNumber?.trim() || null,
          yogaExperience: fields.yogaExperience?.trim() || null,
        }),
      });
      setFields(fieldsFromUser(updated));
      setSaved(true);
      onSaved?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack component="form" spacing={3} onSubmit={save} noValidate>
      <div>
        <Typography variant="h5" component="h2" gutterBottom>
          Your profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Keep your contact details and yoga experience up to date.
        </Typography>
      </div>

      {saved && <Alert severity="success">Profile saved.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="First name"
            required
            fullWidth
            value={fields.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Last name"
            required
            fullWidth
            value={fields.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Preferred name"
            fullWidth
            value={fields.preferredName ?? ''}
            onChange={(event) =>
              updateField('preferredName', event.target.value)
            }
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Phone number"
            type="tel"
            fullWidth
            value={fields.phoneNumber ?? ''}
            onChange={(event) => updateField('phoneNumber', event.target.value)}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            label="Yoga experience"
            fullWidth
            multiline
            minRows={4}
            value={fields.yogaExperience ?? ''}
            onChange={(event) =>
              updateField('yogaExperience', event.target.value)
            }
            helperText="This helps our teachers prepare for private classes."
          />
        </Grid>
      </Grid>

      <Button
        type="submit"
        variant="contained"
        disabled={saving}
        sx={{ alignSelf: 'flex-start' }}
      >
        {saving ? 'Saving…' : 'Save profile'}
      </Button>
    </Stack>
  );
}
