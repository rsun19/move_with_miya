export enum ClassStatus {
  Scheduled = 'Scheduled',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Canceled = 'Canceled',
}

export interface Location {
  id: number;
  name?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface YogaClass {
  id: number;
  name: string;
  teacherIds: string[];
  capacity: number;
  cost: string;
  description: string;
  duration: number;
  imageUrl?: string | null;
  startDate: Date;
  endDate: Date;
  status: ClassStatus;
  locationId: number;
  location: Location;
  isPrivate: boolean;
  waitlistEnabled: boolean;
  cancellationCutoffHours: number;
}
