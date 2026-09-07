import Chip from '@mui/material/Chip';
import type { UserRole } from '@/lib/types';

export default function RoleBadge({ role }: { role: UserRole }) {
  if (role === 'MEMBER') return null;

  return <Chip label={role} color="primary" size="small" />;
}
