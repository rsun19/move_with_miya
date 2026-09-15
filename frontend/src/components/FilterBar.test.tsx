import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { render } from './test-utils';
import FilterBar, { getDefaultFilters, type ClassFilters } from './FilterBar';

const filters: ClassFilters = {
  privacy: 'all',
  timeframe: 'upcoming',
  locationId: null,
  dateFrom: new Date('2026-09-01T00:00:00.000Z'),
  dateTo: null,
};

describe('FilterBar', () => {
  it('defaults to upcoming classes from the start of today', () => {
    const result = getDefaultFilters();
    expect(result.privacy).toBe('all');
    expect(result.timeframe).toBe('upcoming');
    expect(result.locationId).toBeNull();
    expect(result.dateFrom?.getHours()).toBe(0);
  });

  it('emits privacy, timeframe, and location changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <FilterBar
          locations={[
            {
              id: 4,
              name: 'Studio Four',
              address: '4 Main St',
              city: 'Boston',
              state: 'MA',
              zipCode: '02110',
            },
          ]}
          filters={filters}
          onChange={onChange}
        />
      </LocalizationProvider>,
    );

    await user.click(screen.getByLabelText('Privacy'));
    await user.click(screen.getByRole('option', { name: 'Private' }));
    await user.click(screen.getByLabelText('When'));
    await user.click(screen.getByRole('option', { name: 'Finished' }));
    await user.click(screen.getByLabelText('Location'));
    await user.click(screen.getByRole('option', { name: 'Studio Four' }));

    expect(onChange).toHaveBeenNthCalledWith(1, {
      ...filters,
      privacy: 'private',
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      ...filters,
      timeframe: 'finished',
    });
    expect(onChange).toHaveBeenNthCalledWith(3, {
      ...filters,
      locationId: 4,
    });
  });
});
