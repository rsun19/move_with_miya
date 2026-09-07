import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { render } from './test-utils';
import ListView from './ListView';
import { yogaClass } from './test-fixtures';

const classes = [
  yogaClass,
  {
    ...yogaClass,
    id: 2,
    name: 'Evening Restore',
    cost: '5',
    startDate: '2099-06-11T10:00:00.000Z',
    endDate: '2099-06-11T11:00:00.000Z',
  },
];

describe('ListView', () => {
  it('shows an empty state', () => {
    render(
      <ListView classes={[]} onOpen={vi.fn()} registeredClassIds={new Set()} />,
    );
    expect(
      screen.getByText('No classes match your filters.'),
    ).toBeInTheDocument();
  });

  it('sorts classes by price', async () => {
    const user = userEvent.setup();
    render(
      <ListView
        classes={classes}
        onOpen={vi.fn()}
        registeredClassIds={new Set()}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Sort by' }));
    await user.click(screen.getByRole('option', { name: 'Price' }));

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]).toHaveTextContent('Evening Restore');
    expect(headings[1]).toHaveTextContent('Morning Flow');
  });
});
