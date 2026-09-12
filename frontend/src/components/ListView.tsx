'use client';

import { useMemo, useState } from 'react';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { parseISO } from 'date-fns';
import ClassCard from './ClassCard';
import type { YogaClass } from '@/lib/types';

type SortKey = 'date' | 'price' | 'name';

interface ListViewProps {
  classes: YogaClass[];
  onOpen: (cls: YogaClass) => void;
  registeredClassIds: Set<number>;
}

export default function ListView({
  classes,
  onOpen,
  registeredClassIds,
}: ListViewProps) {
  const [sort, setSort] = useState<SortKey>('date');

  const sorted = useMemo(() => {
    const list = [...classes];
    switch (sort) {
      case 'price':
        return list.sort((a, b) => Number(a.cost) - Number(b.cost));
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list.sort(
          (a, b) =>
            parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(),
        );
    }
  }, [classes, sort]);

  return (
    <Stack spacing={2}>
      <Paper
        variant="outlined"
        sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="sort-label">Sort by</InputLabel>
          <Select
            labelId="sort-label"
            label="Sort by"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            <MenuItem value="date">Start date</MenuItem>
            <MenuItem value="price">Price</MenuItem>
            <MenuItem value="name">Name</MenuItem>
          </Select>
        </FormControl>
      </Paper>
      {sorted.length === 0 ? (
        <Typography color="text.secondary">
          No classes match your filters.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {sorted.map((cls) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={cls.id}>
              <ClassCard
                cls={cls}
                onOpen={onOpen}
                isRegistered={registeredClassIds.has(cls.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
