import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { render } from './test-utils';
import ClassCard from './ClassCard';
import { yogaClass } from './test-fixtures';

describe('ClassCard', () => {
  it('renders class details and opens the class', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<ClassCard cls={yogaClass} onOpen={onOpen} isRegistered />);

    expect(
      screen.getByRole('heading', { name: 'Morning Flow' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Studio One, MA')).toBeInTheDocument();
    expect(screen.getByText('2/12')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.getByText('Registered')).toBeInTheDocument();

    await user.click(screen.getByRole('heading', { name: 'Morning Flow' }));
    expect(onOpen).toHaveBeenCalledWith(yogaClass);
  });

  it('renders free classes and unassigned teachers', () => {
    render(
      <ClassCard
        cls={{ ...yogaClass, cost: '0', teachers: [] }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('No teacher assigned')).toBeInTheDocument();
  });
});
