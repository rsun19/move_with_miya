export enum RegistrationStatus {
  Registered = 'registered',
  Waitlisted = 'waitlisted',
  Canceled = 'canceled',
}

export interface Registration {
  id: number;
  userId: string;
  classId: number;
  status: RegistrationStatus;
  registeredAt: Date;
}
