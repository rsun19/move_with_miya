export enum ClassStatus {
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Canceled = 'canceled',
}

export interface Location {
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
  startDate: Date;
  endDate: Date;
  status: ClassStatus;
  location: Location;
  private: boolean;
}
