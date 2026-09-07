import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { render } from './test-utils';
import ClassBrowser from './ClassBrowser';
import { yogaClass } from './test-fixtures';

describe('ClassBrowser', () => {
  it('shows filtered classes and opens their modal', async () => {
    const user = userEvent.setup();
    render(<ClassBrowser classes={[yogaClass]} />);
    expect(screen.getByText('1 class')).toBeInTheDocument();
    expect(screen.getByText('Morning Flow')).toBeInTheDocument();

    await user.click(screen.getByText('Morning Flow'));
    expect(
      screen.getByRole('dialog', { name: /Morning Flow/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sign in to register')).toBeInTheDocument();
  });

  it('switches to the calendar view and filters private classes', async () => {
    const user = userEvent.setup();
    render(
      <ClassBrowser
        classes={[
          yogaClass,
          { ...yogaClass, id: 2, isPrivate: true, name: 'Private Flow' },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Calendar view' }));
    expect(screen.getByText('No classes on this date.')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Privacy'));
    await user.click(screen.getByRole('option', { name: 'Private' }));
    expect(screen.getByText('1 class')).toBeInTheDocument();
  });
});
