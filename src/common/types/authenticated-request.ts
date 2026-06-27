import type { Request } from 'express';
import type { MembershipRole } from '@prisma/client';

export type AuthenticatedUser = {
  userId: string;
  organizationId: string;
  membershipId: string;
  role: MembershipRole;
  sessionId: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
