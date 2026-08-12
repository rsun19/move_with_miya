'use client';

import { useAuth } from '@/lib/auth';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }

  if (user) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="h3" component="h1">
            Welcome back, {user.firstName}
          </Typography>
          <Button
            component={Link}
            href="/dashboard"
            variant="contained"
            size="large"
          >
            Go to Dashboard
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 3,
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h2"
          component="h1"
          sx={{ color: 'primary.main', fontWeight: 700 }}
        >
          Move with Miya
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Yoga class management
        </Typography>
        <Button component={Link} href="/login" variant="contained" size="large">
          Sign in with Google
        </Button>
      </Box>
    </Container>
  );
}
