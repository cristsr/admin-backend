/** HTTP body for revoking an assertion (POST /balance-assertions/{id}/revoke). */
export interface RevokeAssertionInputDto {
  readonly reason: string;
}
