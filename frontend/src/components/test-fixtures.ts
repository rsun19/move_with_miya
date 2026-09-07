import type { YogaClass } from '@/lib/types';

export const yogaClass: YogaClass = {
  id: 1,
  name: 'Morning Flow',
  teacherIds: [],
  capacity: 12,
  cost: '15',
  description: 'A steady morning practice.',
  duration: 60,
  imageUrl: null,
  startDate: '2099-06-10T10:00:00.000Z',
  endDate: '2099-06-10T11:00:00.000Z',
  status: 'Scheduled',
  locationId: 1,
  location: {
    id: 1,
    name: 'Studio One',
    address: '1 Main Street',
    city: 'Boston',
    state: 'MA',
    zipCode: '02110',
  },
  isPrivate: false,
  registrationCount: 2,
  teachers: [],
};
