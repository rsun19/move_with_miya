'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Script from 'next/script';
import { api } from '@/lib/api';

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

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

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function ContactForm() {
  const [fields, setFields] = useState<ContactFields>(initialFields);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactChallenge, setContactChallenge] = useState('');

  const loadContactChallenge = useCallback(async () => {
    try {
      const challenge = await api<{ token: string }>('/api/contact/challenge');
      setContactChallenge(challenge.token);
    } catch {
      setContactChallenge('');
      setError('Contact verification is currently unavailable.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void api<{ token: string }>('/api/contact/challenge')
      .then((challenge) => {
        if (active) setContactChallenge(challenge.token);
      })
      .catch(() => {
        if (active) {
          setContactChallenge('');
          setError('Contact verification is currently unavailable.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

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
    const turnstileToken = new FormData(event.currentTarget).get(
      'turnstileToken',
    );
    if (typeof turnstileToken !== 'string' || !turnstileToken) {
      setError('Please complete the verification challenge.');
      setSubmitted(false);
      return;
    }
    if (!contactChallenge) {
      setError('Please wait a moment and try again.');
      setSubmitted(false);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api('/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          turnstileToken,
          contactChallenge,
        }),
      });
      setFields(initialFields);
      setSubmitted(true);
      window.turnstile?.reset();
      await loadContactChallenge();
    } catch (err) {
      window.turnstile?.reset();
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

      {turnstileSiteKey ? (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
          />
          <div
            className="cf-turnstile"
            data-sitekey={turnstileSiteKey}
            data-action="contact"
            data-appearance="always"
            data-response-field-name="turnstileToken"
            data-theme="auto"
          />
        </>
      ) : (
        <Alert severity="error">Contact verification is not configured.</Alert>
      )}

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
