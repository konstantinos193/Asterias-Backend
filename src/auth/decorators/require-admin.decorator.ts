import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';

/** Enforces authentication and administrator authorization together. */
export const REQUIRE_ADMIN_KEY = 'requireAdmin';
export const RequireAdmin = () => applyDecorators(
  SetMetadata(REQUIRE_ADMIN_KEY, true),
  UseGuards(JwtAuthGuard, AdminGuard),
);

/**
 * Explicit, auditable escape hatch: lets a single handler under an
 * admin-guarded controller serve non-admins. Nothing uses it today — it exists
 * so that opening a route is a deliberate edit rather than an omission.
 */
export const ALLOW_NON_ADMIN_KEY = 'allowNonAdmin';
export const AllowNonAdmin = () => SetMetadata(ALLOW_NON_ADMIN_KEY, true);
