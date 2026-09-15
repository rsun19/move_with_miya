import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { render } from './test-utils';
import CalendarView from './CalendarView';
import { yogaClass } from './test-fixtures';

describe('CalendarView', () => {
  it('shows an empty state when the selected day has no classes', () => {
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <CalendarView
          classes={[]}
          onOpen={vi.fn()}
          registeredClassIds={new Set()}
        />
      </LocalizationProvider>,
    );
    expect(screen.getByText('No classes on this date.')).toBeInTheDocument();
  });

  it('renders classes scheduled for today', () => {
    const today = new Date();
    const todayClass = {
      ...yogaClass,
      startDate: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        10,
      ).toISOString(),
      endDate: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        11,
      ).toISOString(),
    };
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <CalendarView
          classes={[todayClass]}
          onOpen={vi.fn()}
          registeredClassIds={new Set([todayClass.id])}
        />
      </LocalizationProvider>,
    );
    expect(screen.getByText('Morning Flow')).toBeInTheDocument();
    expect(screen.getByText('Registered')).toBeInTheDocument();
  });
});
