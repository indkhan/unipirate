/**
 * The single admin predicate: the JWT `app_metadata.role` claim — the same one
 * `public.is_admin()` reads inside every admin RLS policy. Shape-compatible
 * with both `User["app_metadata"]` and `JwtPayload["app_metadata"]`.
 */
export const isAdminRole = (
  metadata?: { [key: string]: unknown } | null,
): boolean => metadata?.role === "admin";
