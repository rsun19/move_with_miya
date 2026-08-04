'use client';

import { useAuth } from '@/lib/auth';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 4,
        }}
      >
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Button onClick={logout} variant="outlined">
          Sign out
        </Button>
      </Box>
      <Card>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {user?.avatarUrl && (
            <Avatar
              src={user.avatarUrl}
              alt=""
              sx={{ width: 56, height: 56 }}
            />
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
          {user?.role && user.role !== 'MEMBER' && (
            <Chip label={user.role} color="primary" size="small" />
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
