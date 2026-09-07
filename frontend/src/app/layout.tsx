import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import ThemeRegistry from '@/components/ThemeRegistry';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Box from '@mui/material/Box';

export const metadata: Metadata = {
  title: 'Move with Miya',
  description: 'Yoga class management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ThemeRegistry>
          <AuthProvider>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
              }}
            >
              <Navbar />
              <Box component="main" sx={{ flexGrow: 1 }}>
                {children}
              </Box>
              <Footer />
            </Box>
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
