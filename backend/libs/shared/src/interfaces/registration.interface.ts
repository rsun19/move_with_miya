export enum RegistrationStatus {
  Registered = 'registered',
  Waitlisted = 'waitlisted',
  Canceled = 'canceled',
}

export interface Registration {
  id: number;
  userId: number;
  classId: number;
  status: RegistrationStatus;
  registeredAt: Date;
}
