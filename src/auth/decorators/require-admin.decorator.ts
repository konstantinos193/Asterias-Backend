import { SetMetadata } from '@nestjs/common';

/**
 * Historical marker. AdminGuard used to grant access unless this was present
 * on the handler, which meant every route that applied the guard without it —
 * and every route that carried it on the controller class instead, because the
 * guard only ever read `getHandler()` — was open to any signed-in user.
 *
 * Applying AdminGuard is now the requirement by itself. The decorator is kept
 * because it documents intent at the call site and reads well next to
 * `@UseGuards(JwtAuthGuard, AdminGuard)`.
 */
export const REQUIRE_ADMIN_KEY = 'requireAdmin';
export const RequireAdmin = () => SetMetadata(REQUIRE_ADMIN_KEY, true);

/**
 * Explicit, auditable escape hatch: lets a single handler under an
 * admin-guarded controller serve non-admins. Nothing uses it today — it exists
 * so that opening a route is a deliberate edit rather than an omission.
 */
export const ALLOW_NON_ADMIN_KEY = 'allowNonAdmin';
export const AllowNonAdmin = () => SetMetadata(ALLOW_NON_ADMIN_KEY, true);
