import type { MembershipRole } from '@prisma/client';

export type AuthOrganizationResponse = {
  id: string;
  name: string;
};

export type AuthUserResponse = {
  id: string;
  organizationId: string;
  membershipId: string;
  name: string;
  email: string;
  role: MembershipRole;
  organization: AuthOrganizationResponse;
};

export type AuthResponse = {
  user: AuthUserResponse;
};

export type TokenPayload = {
  userId: string;
  organizationId: string;
  membershipId: string;
  role: MembershipRole;
  sessionId: string;
  rememberMe?: boolean;
};
