'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { api } from '@/lib/api';

interface ContactFields {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const initialFields: ContactFields = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

export default function ContactForm() {
  const [fields, setFields] = useState<ContactFields>(initialFields);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof ContactFields, value: string) => {
    setFields((previous) => ({ ...previous, [field]: value }));
    setSubmitted(false);
    setError(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = {
      name: fields.name.trim(),
      email: fields.email.trim(),
      subject: fields.subject.trim(),
      message: fields.message.trim(),
    };
    if (!values.name || !values.email || !values.subject || !values.message) {
      setError('Please complete every field.');
      setSubmitted(false);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      setError('Please enter a valid email address.');
      setSubmitted(false);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api('/api/contact', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setFields(initialFields);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
      setSubmitted(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack component="form" spacing={3} onSubmit={submit} noValidate>
      <div>
        <Typography variant="h5" component="h2" gutterBottom>
          Send us a message
        </Typography>
        <Typography variant="body2" color="text.secondary">
          We&apos;ll get back to you as soon as we can.
        </Typography>
      </div>

      {submitted && (
        <Alert severity="success">
          Thanks for reaching out. Your message has been sent.
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        label="Name"
        required
        fullWidth
        value={fields.name}
        onChange={(event) => updateField('name', event.target.value)}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />
      <TextField
        label="Email"
        required
        fullWidth
        type="email"
        value={fields.email}
        onChange={(event) => updateField('email', event.target.value)}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />
      <TextField
        label="Subject"
        required
        fullWidth
        value={fields.subject}
        onChange={(event) => updateField('subject', event.target.value)}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />
      <TextField
        label="Message"
        required
        fullWidth
        multiline
        minRows={6}
        value={fields.message}
        onChange={(event) => updateField('message', event.target.value)}
        slotProps={{ htmlInput: { maxLength: 10000 } }}
      />
      <Button
        type="submit"
        variant="contained"
        disabled={submitting}
        sx={{ alignSelf: 'flex-start' }}
      >
        {submitting ? 'Sending…' : 'Send message'}
      </Button>
    </Stack>
  );
}
