import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from './test-utils';
import ContactForm from './ContactForm';

afterEach(() => vi.restoreAllMocks());

function challengeResponse() {
  return new Response(JSON.stringify({ token: 'challenge-token' }), {
    status: 200,
  });
}

function addTurnstileToken() {
  const form = screen
    .getByRole('button', { name: 'Send message' })
    .closest('form');
  if (!form) throw new Error('Contact form not found');

  const token = document.createElement('input');
  token.name = 'turnstileToken';
  token.value = 'turnstile-token';
  form.append(token);
}

describe('ContactForm', () => {
  it('requires every field before submitting', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(challengeResponse());
    render(<ContactForm />);

    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      screen.getByText('Please complete every field.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/contact',
      expect.anything(),
    );
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(challengeResponse());
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/^Name/), 'Person');
    await user.type(screen.getByLabelText(/^Email/), 'invalid-email');
    await user.type(screen.getByLabelText(/^Subject/), 'Question');
    await user.type(screen.getByLabelText(/^Message/), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      screen.getByText('Please enter a valid email address.'),
    ).toBeInTheDocument();
  });

  it('submits trimmed fields and clears the form', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(challengeResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1 }), { status: 201 }),
      )
      .mockResolvedValueOnce(challengeResponse());
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/^Name/), ' Person ');
    await user.type(screen.getByLabelText(/^Email/), 'person@example.com');
    await user.type(screen.getByLabelText(/^Subject/), ' Question ');
    await user.type(screen.getByLabelText(/^Message/), ' Hello ');
    addTurnstileToken();
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      await screen.findByText(/Thanks for reaching out/),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/contact',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Person',
          email: 'person@example.com',
          subject: 'Question',
          message: 'Hello',
          turnstileToken: 'turnstile-token',
          contactChallenge: 'challenge-token',
        }),
      }),
    );
    expect(screen.getByLabelText(/^Name/)).toHaveValue('');
  });

  it('shows API failures to the user', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(challengeResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Service unavailable' }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(challengeResponse());
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/^Name/), 'Person');
    await user.type(screen.getByLabelText(/^Email/), 'person@example.com');
    await user.type(screen.getByLabelText(/^Subject/), 'Question');
    await user.type(screen.getByLabelText(/^Message/), 'Hello');
    addTurnstileToken();
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
  });
});
