/**
 * Auth adapters — Keycloak OIDC is the enterprise default.
 * Milestone 1: interface only.
 */

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly orgId?: string;
}

export interface AuthPort {
  verifyAccessToken(token: string): Promise<AuthUser>;
}

export class KeycloakAuthAdapter implements AuthPort {
  constructor(private readonly issuer: string) {}

  async verifyAccessToken(_token: string): Promise<AuthUser> {
    throw new Error(
      `OIDC verification not wired yet. Configure Keycloak issuer (${this.issuer}) in Milestone 2.`,
    );
  }
}
