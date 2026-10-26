/**
 * Upload limits for the image endpoints.
 *
 * These were declared twice — once on `MulterModule.register()` and once on the
 * `FilesInterceptor` for the upload route — so raising one left the other in
 * place and the effective limit was whichever happened to be lower.
 */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_COUNT = 10;
