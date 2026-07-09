/**
 * Single-user app: no auth provider is wired up (and none before its phase),
 * but every query is still scoped by userId so real auth can drop in later
 * by replacing this function.
 */
export function getUserId(): string {
  return "local-user";
}
