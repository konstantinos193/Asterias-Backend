import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Rejects MongoDB operator syntax arriving from the outside.
 *
 * Express parses `?status[$ne]=CANCELLED` into `{ status: { $ne: 'CANCELLED' } }`
 * — a real object, not a string. Any handler that drops a query value straight
 * into a filter (`if (status) filter.status = status`) therefore lets a caller
 * supply operators instead of values: `$ne` to invert a condition, `$gt` to
 * walk a range, `$regex` to pull a field apart character by character.
 *
 * Dotted keys are refused for the same reason: `{"guestInfo.email": ...}` in an
 * update body reaches into a subdocument that the DTO never described.
 *
 * This runs ahead of ValidationPipe, so it also covers handlers whose body is
 * untyped and which `whitelist` consequently cannot clean.
 */
@Injectable()
export class MongoSanitizePipe implements PipeTransform {
  /** Deep enough for anything legitimate here; stops absurdly nested payloads. */
  private static readonly MAX_DEPTH = 12;

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'custom') {
      return value;
    }
    this.assertClean(value, 0, metadata.type);
    return value;
  }

  private assertClean(value: unknown, depth: number, source: string): void {
    if (depth > MongoSanitizePipe.MAX_DEPTH) {
      throw new BadRequestException('Request payload is nested too deeply');
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.assertClean(item, depth + 1, source);
      }
      return;
    }

    // Dates, buffers and the like are not plain objects and hold no keys worth
    // inspecting.
    if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) === null) {
      return;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      return;
    }

    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (key.startsWith('$')) {
        throw new BadRequestException(`Illegal field name in ${source}: ${key}`);
      }
      if (key.includes('.')) {
        throw new BadRequestException(`Illegal field name in ${source}: ${key}`);
      }
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new BadRequestException(`Illegal field name in ${source}: ${key}`);
      }
      this.assertClean((value as Record<string, unknown>)[key], depth + 1, source);
    }
  }
}
