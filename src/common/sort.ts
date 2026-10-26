/**
 * Builds a Mongo sort from a caller-supplied field name.
 *
 * Handlers used to do `sort[sortBy] = -1` with whatever arrived in the query
 * string. Two problems with that: sorting by an unindexed field makes the
 * database scan the collection, which is a cheap way to tie it up; and sorting
 * by a field the caller cannot read — `password`, say — still orders the page
 * by it, which turns a paginated list into an oracle for a value that is
 * supposed to be invisible.
 */
export function safeSort(
  sortBy: unknown,
  allowed: readonly string[],
  fallback: string,
  sortOrder: unknown,
): Record<string, 1 | -1> {
  const field = typeof sortBy === 'string' && allowed.includes(sortBy) ? sortBy : fallback;
  const direction: 1 | -1 = sortOrder === 'asc' ? 1 : -1;
  return { [field]: direction };
}
