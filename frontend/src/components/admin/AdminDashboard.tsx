'use client';

import { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import type {
  AdminUser,
  ContactSubmission,
  Location,
  Registration,
  YogaClass,
} from '@/lib/types';

interface AdminDashboardProps {
  initialClasses: YogaClass[];
  initialLocations: Location[];
  initialContact: ContactSubmission[];
  initialUsers: AdminUser[];
}

type TabValue = 'classes' | 'locations' | 'registrations' | 'contact' | 'users';

const emptyClassForm = {
  name: '',
  capacity: '10',
  cost: '0',
  description: '',
  duration: '60',
  startDate: '',
  endDate: '',
  locationId: '',
  teacherIds: [] as string[],
  isPrivate: false,
  status: 'Scheduled',
};

const emptyLocationForm = {
  name: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
};

export default function AdminDashboard({
  initialClasses,
  initialLocations,
  initialContact,
  initialUsers,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<TabValue>('classes');
  const [classes, setClasses] = useState<YogaClass[]>(initialClasses);
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [contact] = useState<ContactSubmission[]>(initialContact);
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);

  const [classDialog, setClassDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<YogaClass | null>(null);
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [classErrors, setClassErrors] = useState<Record<string, string>>({});

  const [locationDialog, setLocationDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationForm, setLocationForm] = useState(emptyLocationForm);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setError(null);
  };
  const showError = (msg: string) => {
    setError(msg);
    setNotice(null);
  };

  const loadRegistrations = useCallback(async (classId: string) => {
    if (!classId) {
      setRegistrations([]);
      return;
    }
    setRegistrationsLoading(true);
    try {
      const data = await api<Registration[]>(
        `/api/registration/class/${classId}`,
      );
      setRegistrations(data);
    } catch {
      setRegistrations([]);
    } finally {
      setRegistrationsLoading(false);
    }
  }, []);

  const handleTabChange = (value: TabValue) => {
    setTab(value);
    if (value === 'registrations' && selectedClassId) {
      void loadRegistrations(selectedClassId);
    }
  };

  const openNewClass = () => {
    setEditingClass(null);
    setClassErrors({});
    setClassForm({
      ...emptyClassForm,
      locationId: locations[0] ? String(locations[0].id) : '',
    });
    setClassDialog(true);
  };

  const openEditClass = (cls: YogaClass) => {
    setEditingClass(cls);
    setClassErrors({});
    setClassForm({
      name: cls.name,
      capacity: String(cls.capacity),
      cost: cls.cost,
      description: cls.description,
      duration: String(cls.duration),
      startDate: format(new Date(cls.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(cls.endDate), "yyyy-MM-dd'T'HH:mm"),
      locationId: String(cls.locationId),
      teacherIds: cls.teacherIds ?? [],
      isPrivate: cls.isPrivate,
      status: cls.status,
    });
    setClassDialog(true);
  };

  const saveClass = async () => {
    try {
      const errors: Record<string, string> = {};
      if (!classForm.name.trim()) errors.name = 'Name is required.';
      if (!classForm.locationId) errors.locationId = 'Location is required.';
      if (!classForm.capacity || Number(classForm.capacity) <= 0) {
        errors.capacity = 'Capacity must be greater than 0.';
      }
      if (classForm.cost === '' || Number.isNaN(Number(classForm.cost))) {
        errors.cost = 'Cost is required.';
      }
      if (!classForm.duration || Number(classForm.duration) <= 0) {
        errors.duration = 'Duration must be greater than 0.';
      }
      if (
        !classForm.startDate ||
        Number.isNaN(new Date(classForm.startDate).getTime())
      ) {
        errors.startDate = 'Start date is required.';
      }
      if (
        !classForm.endDate ||
        Number.isNaN(new Date(classForm.endDate).getTime())
      ) {
        errors.endDate = 'End date is required.';
      }
      if (
        !errors.startDate &&
        !errors.endDate &&
        new Date(classForm.endDate).getTime() <=
          new Date(classForm.startDate).getTime()
      ) {
        errors.endDate = 'End date must be after start date.';
      }
      if (Object.keys(errors).length > 0) {
        setClassErrors(errors);
        return;
      }
      setClassErrors({});
      const payload = {
        name: classForm.name,
        capacity: Number(classForm.capacity),
        cost: classForm.cost,
        description: classForm.description,
        duration: Number(classForm.duration),
        startDate: new Date(classForm.startDate).toISOString(),
        endDate: new Date(classForm.endDate).toISOString(),
        locationId: Number(classForm.locationId),
        teacherIds: classForm.teacherIds,
        isPrivate: classForm.isPrivate,
        status: classForm.status,
      };
      if (editingClass) {
        await api(`/api/classes/${editingClass.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await api('/api/classes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      const updated = await api<YogaClass[]>('/api/classes');
      setClasses(updated);
      setClassDialog(false);
      showNotice(editingClass ? 'Class updated.' : 'Class created.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const deleteClass = async (id: number) => {
    if (!confirm('Delete this class?')) return;
    try {
      await api(`/api/classes/${id}`, { method: 'DELETE' });
      const updated = await api<YogaClass[]>('/api/classes');
      setClasses(updated);
      showNotice('Class deleted.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const openNewLocation = () => {
    setEditingLocation(null);
    setLocationForm(emptyLocationForm);
    setLocationDialog(true);
  };

  const openEditLocation = (loc: Location) => {
    setEditingLocation(loc);
    setLocationForm({
      name: loc.name ?? '',
      address: loc.address,
      city: loc.city,
      state: loc.state,
      zipCode: loc.zipCode,
    });
    setLocationDialog(true);
  };

  const saveLocation = async () => {
    try {
      const payload = { ...locationForm, name: locationForm.name || null };
      if (editingLocation) {
        await api(`/api/locations/${editingLocation.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await api('/api/locations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      const updated = await api<Location[]>('/api/locations');
      setLocations(updated);
      setLocationDialog(false);
      showNotice(editingLocation ? 'Location updated.' : 'Location created.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const deleteLocation = async (id: number) => {
    if (!confirm('Delete this location?')) return;
    try {
      await api(`/api/locations/${id}`, { method: 'DELETE' });
      const updated = await api<Location[]>('/api/locations');
      setLocations(updated);
      showNotice('Location deleted.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const cancelRegistration = async (id: number) => {
    if (!confirm('Cancel this registration?')) return;
    try {
      await api(`/api/registration/${id}`, { method: 'DELETE' });
      if (selectedClassId) {
        await loadRegistrations(selectedClassId);
      }
      showNotice('Registration cancelled.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Cancel failed.');
    }
  };

  const updateUserRole = async (id: string, role: string) => {
    try {
      await api(`/api/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      showNotice('User role updated.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Role update failed.');
    }
  };

  const toggleUserBan = async (id: string) => {
    try {
      await api(`/api/users/${id}/ban`, { method: 'PATCH' });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, banned: !u.banned } : u)),
      );
      showNotice('User ban status updated.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Ban update failed.');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        Admin
      </Typography>

      {notice && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setNotice(null)}
        >
          {notice}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => handleTabChange(v)} sx={{ mb: 3 }}>
        <Tab label="Classes" value="classes" />
        <Tab label="Locations" value="locations" />
        <Tab label="Registrations" value="registrations" />
        <Tab label="Contact" value="contact" />
        <Tab label="Users" value="users" />
      </Tabs>

      {tab === 'classes' && (
        <Stack spacing={2}>
          <Box>
            <Button variant="contained" onClick={openNewClass}>
              New Class
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Start</TableCell>
                  <TableCell>Capacity</TableCell>
                  <TableCell>Cost</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Private</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {classes.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell>{cls.name}</TableCell>
                    <TableCell>
                      {format(new Date(cls.startDate), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell>{cls.capacity}</TableCell>
                    <TableCell>${cls.cost}</TableCell>
                    <TableCell>
                      {cls.location.name ??
                        `${cls.location.city}, ${cls.location.state}`}
                    </TableCell>
                    <TableCell>{cls.status}</TableCell>
                    <TableCell>{cls.isPrivate ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => openEditClass(cls)}>
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => deleteClass(cls.id)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {classes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No classes yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {tab === 'locations' && (
        <Stack spacing={2}>
          <Box>
            <Button variant="contained" onClick={openNewLocation}>
              New Location
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>ZIP</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell>{loc.name ?? '—'}</TableCell>
                    <TableCell>{loc.address}</TableCell>
                    <TableCell>{loc.city}</TableCell>
                    <TableCell>{loc.state}</TableCell>
                    <TableCell>{loc.zipCode}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          onClick={() => openEditLocation(loc)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => deleteLocation(loc.id)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {locations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No locations yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {tab === 'registrations' && (
        <Stack spacing={2}>
          <FormControl sx={{ maxWidth: 320 }}>
            <InputLabel id="reg-class-label">Class</InputLabel>
            <Select
              labelId="reg-class-label"
              label="Class"
              value={selectedClassId}
              onChange={(e) => {
                const id = e.target.value as string;
                setSelectedClassId(id);
                if (id) {
                  void loadRegistrations(id);
                }
              }}
            >
              {classes.map((cls) => (
                <MenuItem key={cls.id} value={String(cls.id)}>
                  {cls.name} —{' '}
                  {format(new Date(cls.startDate), 'MMM d, h:mm a')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {registrationsLoading && <CircularProgress size={24} />}

          {!registrationsLoading && selectedClassId && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Registered</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>{reg.id}</TableCell>
                      <TableCell>
                        {reg.user
                          ? `${reg.user.firstName} ${reg.user.lastName}`.trim()
                          : reg.userId}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          {reg.user ? reg.user.role : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={reg.status}
                          size="small"
                          color={
                            reg.status === 'registered' ? 'success' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {format(new Date(reg.registeredAt), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => cancelRegistration(reg.id)}
                        >
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {registrations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No registrations for this class.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      )}

      {tab === 'contact' && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contact.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {format(new Date(item.createdAt), 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>{item.subject}</TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>{item.message}</TableCell>
                </TableRow>
              ))}
              {contact.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No contact submissions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 'users' && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <FormControl size="small">
                      <Select
                        value={user.role}
                        onChange={(e) =>
                          updateUserRole(user.id, e.target.value as string)
                        }
                        sx={{ minWidth: 110 }}
                      >
                        <MenuItem value="ADMIN">Admin</MenuItem>
                        <MenuItem value="TEACHER">Teacher</MenuItem>
                        <MenuItem value="MEMBER">Member</MenuItem>
                        <MenuItem value="VIEWER">Viewer</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.banned ? 'Banned' : 'Active'}
                      size="small"
                      color={user.banned ? 'error' : 'success'}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      color={user.banned ? 'success' : 'warning'}
                      onClick={() => toggleUserBan(user.id)}
                    >
                      {user.banned ? 'Unban' : 'Ban'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No users yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={classDialog}
        onClose={() => setClassDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingClass ? 'Edit Class' : 'New Class'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={12}>
              <TextField
                label="Name"
                required
                fullWidth
                value={classForm.name}
                onChange={(e) =>
                  setClassForm({ ...classForm, name: e.target.value })
                }
                error={Boolean(classErrors.name)}
                helperText={classErrors.name}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Capacity"
                type="number"
                required
                fullWidth
                value={classForm.capacity}
                onChange={(e) =>
                  setClassForm({ ...classForm, capacity: e.target.value })
                }
                error={Boolean(classErrors.capacity)}
                helperText={classErrors.capacity}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Cost"
                type="number"
                required
                fullWidth
                value={classForm.cost}
                onChange={(e) =>
                  setClassForm({ ...classForm, cost: e.target.value })
                }
                error={Boolean(classErrors.cost)}
                helperText={classErrors.cost}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Duration (min)"
                type="number"
                required
                fullWidth
                value={classForm.duration}
                onChange={(e) =>
                  setClassForm({ ...classForm, duration: e.target.value })
                }
                error={Boolean(classErrors.duration)}
                helperText={classErrors.duration}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel id="status-label">Status</InputLabel>
                <Select
                  labelId="status-label"
                  label="Status"
                  value={classForm.status}
                  onChange={(e) =>
                    setClassForm({ ...classForm, status: e.target.value })
                  }
                >
                  <MenuItem value="Scheduled">Scheduled</MenuItem>
                  <MenuItem value="InProgress">In Progress</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                  <MenuItem value="Canceled">Canceled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Start"
                type="datetime-local"
                required
                fullWidth
                value={classForm.startDate}
                onChange={(e) =>
                  setClassForm({ ...classForm, startDate: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(classErrors.startDate)}
                helperText={classErrors.startDate}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="End"
                type="datetime-local"
                required
                fullWidth
                value={classForm.endDate}
                onChange={(e) =>
                  setClassForm({ ...classForm, endDate: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(classErrors.endDate)}
                helperText={classErrors.endDate}
              />
            </Grid>
            <Grid size={12}>
              <FormControl
                fullWidth
                required
                error={Boolean(classErrors.locationId)}
              >
                <InputLabel id="loc-label">Location</InputLabel>
                <Select
                  labelId="loc-label"
                  label="Location"
                  value={classForm.locationId}
                  onChange={(e) =>
                    setClassForm({ ...classForm, locationId: e.target.value })
                  }
                >
                  {locations.map((loc) => (
                    <MenuItem key={loc.id} value={String(loc.id)}>
                      {loc.name ?? `${loc.city}, ${loc.state}`}
                    </MenuItem>
                  ))}
                </Select>
                {classErrors.locationId && (
                  <FormHelperText error>
                    {classErrors.locationId}
                  </FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel id="teachers-label">Teachers</InputLabel>
                <Select
                  labelId="teachers-label"
                  label="Teachers"
                  multiple
                  value={classForm.teacherIds}
                  onChange={(e) => {
                    const value = e.target.value as string[];
                    setClassForm({ ...classForm, teacherIds: value });
                  }}
                  renderValue={(selected) => {
                    const sel = selected as string[];
                    if (sel.length === 0) return <em>No teacher assigned</em>;
                    return sel
                      .map((id) => {
                        const u = users.find((u) => u.id === id);
                        return u ? `${u.firstName} ${u.lastName}`.trim() : id;
                      })
                      .join(', ');
                  }}
                >
                  {users.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {`${u.firstName} ${u.lastName}`.trim()} ({u.role})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              <TextField
                label="Description"
                multiline
                minRows={2}
                fullWidth
                value={classForm.description}
                onChange={(e) =>
                  setClassForm({ ...classForm, description: e.target.value })
                }
              />
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={classForm.isPrivate}
                    onChange={(e) =>
                      setClassForm({
                        ...classForm,
                        isPrivate: e.target.checked,
                      })
                    }
                  />
                }
                label="Private class"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={saveClass}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={locationDialog}
        onClose={() => setLocationDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingLocation ? 'Edit Location' : 'New Location'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={12}>
              <TextField
                label="Name"
                fullWidth
                value={locationForm.name}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, name: e.target.value })
                }
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Address"
                fullWidth
                value={locationForm.address}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, address: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="City"
                fullWidth
                value={locationForm.city}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, city: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 3 }}>
              <TextField
                label="State"
                fullWidth
                value={locationForm.state}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, state: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 3 }}>
              <TextField
                label="ZIP"
                fullWidth
                value={locationForm.zipCode}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, zipCode: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocationDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={saveLocation}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
