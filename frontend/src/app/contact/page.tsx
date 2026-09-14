import type { Metadata } from 'next';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import ContactForm from '@/components/ContactForm';

export const metadata: Metadata = {
  title: 'Contact | Move with Miya',
  description: 'Contact Move with Miya with questions about yoga classes.',
};

export default function ContactPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={2} sx={{ p: { xs: 3, sm: 5 } }}>
        <ContactForm />
      </Paper>
    </Container>
  );
}
