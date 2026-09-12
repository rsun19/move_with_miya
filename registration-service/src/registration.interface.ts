export enum RegistrationStatus {
  Registered = 'Registered',
  Waitlisted = 'Waitlisted',
  Canceled = 'Canceled',
}

export interface Registration {
  id: number;
  userId: string;
  classId: number;
  status: RegistrationStatus;
  registeredAt: Date;
}
