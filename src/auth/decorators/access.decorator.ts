import { SetMetadata } from '@nestjs/common';
export const ACCESS_LEVEL = 'accessLevel';
/** Deliberate exceptions to the global admin-only default. */
export const Public = () => SetMetadata(ACCESS_LEVEL, 'public');
export const Authenticated = () => SetMetadata(ACCESS_LEVEL, 'authenticated');
