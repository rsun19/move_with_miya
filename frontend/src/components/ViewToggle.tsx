'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';

export type ViewMode = 'calendar' | 'list';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      aria-label="Class view"
      onChange={(_event, next: ViewMode | null) => {
        if (next) onChange(next);
      }}
    >
      <ToggleButton value="calendar" aria-label="Calendar view">
        <CalendarMonthOutlinedIcon />
      </ToggleButton>
      <ToggleButton value="list" aria-label="List view">
        <ViewListOutlinedIcon />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
