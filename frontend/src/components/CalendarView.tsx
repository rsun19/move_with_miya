'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickerDay, type PickerDayProps } from '@mui/x-date-pickers/PickerDay';
import { format, isSameDay, parseISO } from 'date-fns';
import ClassCard from './ClassCard';
import type { YogaClass } from '@/lib/types';

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

interface CalendarViewProps {
  classes: YogaClass[];
  onOpen: (cls: YogaClass) => void;
  registeredClassIds: Set<number>;
}

export default function CalendarView({
  classes,
  onOpen,
  registeredClassIds,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const datesWithClasses = useMemo(
    () => new Set(classes.map((cls) => dateKey(parseISO(cls.startDate)))),
    [classes],
  );

  const DayComponent = useMemo(() => {
    function CalendarDay(props: PickerDayProps) {
      const { day, outsideCurrentMonth, ...other } = props;
      const hasClasses = datesWithClasses.has(dateKey(day));
      return (
        <PickerDay
          {...other}
          day={day}
          outsideCurrentMonth={outsideCurrentMonth}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1,
            }}
          >
            <span>{format(day, 'd')}</span>
            <Box
              aria-hidden
              sx={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                bgcolor:
                  !outsideCurrentMonth && hasClasses
                    ? 'primary.main'
                    : 'transparent',
                mt: 0.25,
              }}
            />
          </Box>
        </PickerDay>
      );
    }
    return CalendarDay;
  }, [datesWithClasses]);

  const classesOnDate = classes
    .filter((cls) => isSameDay(parseISO(cls.startDate), selectedDate))
    .sort(
      (a, b) =>
        parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(),
    );

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        spacing={2}
        direction={{ xs: 'column', md: 'row' }}
        sx={{ alignItems: 'flex-start' }}
      >
        <Box>
          <DateCalendar
            value={selectedDate}
            onChange={(value) => {
              if (value) setSelectedDate(value);
            }}
            slots={{ day: DayComponent }}
          />
        </Box>
        <Box sx={{ flexGrow: 1, width: '100%' }}>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
            {format(selectedDate, 'EEEE, MMMM d')}
          </Typography>
          {classesOnDate.length === 0 ? (
            <Typography color="text.secondary">
              No classes on this date.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {classesOnDate.map((cls) => (
                <Grid size={{ xs: 12, sm: 6 }} key={cls.id}>
                  <ClassCard
                    cls={cls}
                    onOpen={onOpen}
                    isRegistered={registeredClassIds.has(cls.id)}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
