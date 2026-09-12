'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import ViewToggle, { type ViewMode } from './ViewToggle';
import FilterBar, { getDefaultFilters, type ClassFilters } from './FilterBar';
import CalendarView from './CalendarView';
import ListView from './ListView';
import ClassModal from './ClassModal';
import type { Location, YogaClass } from '@/lib/types';

interface ClassBrowserProps {
  classes: YogaClass[];
  currentUserId?: string | null;
  registeredClassIds?: number[];
}

export default function ClassBrowser({
  classes,
  currentUserId = null,
  registeredClassIds = [],
}: ClassBrowserProps) {
  const [view, setView] = useState<ViewMode>('list');
  const [now] = useState(() => new Date().getTime());
  const [filters, setFilters] = useState<ClassFilters>(() =>
    getDefaultFilters(),
  );
  const [selectedClass, setSelectedClass] = useState<YogaClass | null>(null);
  const [registered, setRegistered] = useState<Set<number>>(
    () => new Set(registeredClassIds),
  );

  const locations = useMemo(() => {
    const map = new Map<number, Location>();
    for (const cls of classes) {
      map.set(cls.locationId, cls.location);
    }
    return [...map.values()];
  }, [classes]);

  const filtered = useMemo(() => {
    const from = filters.dateFrom ? startOfDay(filters.dateFrom) : null;
    const to = filters.dateTo ? endOfDay(filters.dateTo) : null;
    return classes.filter((cls) => {
      if (filters.privacy === 'public' && cls.isPrivate) return false;
      if (filters.privacy === 'private' && !cls.isPrivate) return false;
      if (
        filters.locationId !== null &&
        cls.locationId !== filters.locationId
      ) {
        return false;
      }
      const ended = parseISO(cls.endDate).getTime() < now;
      if (filters.timeframe === 'upcoming' && ended) return false;
      if (filters.timeframe === 'finished' && !ended) return false;
      const start = parseISO(cls.startDate);
      if (from && start < from) return false;
      if (to && start > to) return false;
      return true;
    });
  }, [classes, filters, now]);

  const handleRegisteredChange = (classId: number, isRegistered: boolean) => {
    setRegistered((prev) => {
      const next = new Set(prev);
      if (isRegistered) {
        next.add(classId);
      } else {
        next.delete(classId);
      }
      return next;
    });
  };

  const sharedViewProps = {
    classes: filtered,
    onOpen: setSelectedClass,
    registeredClassIds: registered,
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="h4" component="h1">
                Classes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filtered.length} class{filtered.length === 1 ? '' : 'es'}
              </Typography>
            </Box>
            <ViewToggle value={view} onChange={setView} />
          </Box>

          <FilterBar
            locations={locations}
            filters={filters}
            onChange={setFilters}
          />

          {view === 'calendar' ? (
            <CalendarView {...sharedViewProps} />
          ) : (
            <ListView {...sharedViewProps} />
          )}
        </Stack>
      </Container>

      {selectedClass && (
        <ClassModal
          cls={selectedClass}
          currentUserId={currentUserId}
          isRegistered={registered.has(selectedClass.id)}
          onClose={() => setSelectedClass(null)}
          onRegisteredChange={handleRegisteredChange}
        />
      )}
    </LocalizationProvider>
  );
}
