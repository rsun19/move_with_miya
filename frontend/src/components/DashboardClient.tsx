'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { AuthUser } from '@/lib/types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import RoleBadge from '@/components/RoleBadge';
import ProfileForm from '@/components/ProfileForm';

export default function DashboardClient({ user }: { user: AuthUser }) {
  const { logout } = useAuth();
  const [displayedUser, setDisplayedUser] = useState(user);

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
          {displayedUser.avatarUrl && (
            <Avatar
              src={displayedUser.avatarUrl}
              alt=""
              sx={{ width: 56, height: 56 }}
            />
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">
              {displayedUser.firstName} {displayedUser.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {displayedUser.email}
            </Typography>
          </Box>
          {displayedUser.role && <RoleBadge role={displayedUser.role} />}
        </CardContent>
      </Card>
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <ProfileForm user={displayedUser} onSaved={setDisplayedUser} />
        </CardContent>
      </Card>
    </Container>
  );
}
