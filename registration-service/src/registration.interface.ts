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
  updatedAt?: Date;
  canceledAt?: Date | null;
  waitlistedAt?: Date | null;
  promotedAt?: Date | null;
  cancellationReason?: string | null;
  source?: string;
  waitlistPosition?: number;
}
