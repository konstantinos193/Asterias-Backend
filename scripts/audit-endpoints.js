// Reflection-based endpoint audit. Reads the real decorator metadata off the
// compiled controllers, so it reports what Nest will actually enforce.
require('reflect-metadata');
const fs = require('fs');
const path = require('path');

const DIST = process.argv[2] || path.join(__dirname, '..', 'dist');
const { Reflector } = require('@nestjs/core');

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.controller.js')) files.push(p);
  }
})(DIST);

const reflector = new Reflector();
const rows = [];

for (const file of files) {
  const mod = require(file);
  for (const exported of Object.values(mod)) {
    if (typeof exported !== 'function') continue;
    const basePath = Reflect.getMetadata('path', exported);
    if (basePath === undefined) continue;

    const classGuards = (Reflect.getMetadata('__guards__', exported) || []).map((g) => g.name);
    const proto = exported.prototype;

    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name];
      const routePath = Reflect.getMetadata('path', handler);
      if (routePath === undefined) continue;

      const methodIdx = Reflect.getMetadata('method', handler);
      const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];
      const guards = [
        ...classGuards,
        ...(Reflect.getMetadata('__guards__', handler) || []).map((g) => g.name),
      ];
      const allowNonAdmin = reflector.getAllAndOverride('allowNonAdmin', [handler, exported]);
      const throttle = Reflect.getMetadata('THROTTLER:LIMIT', handler) ? 'tight' : '';

      const url = ('/' + basePath + '/' + routePath).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      rows.push({
        route: `${METHODS[methodIdx]} ${url}`,
        guards: [...new Set(guards)],
        allowNonAdmin: !!allowNonAdmin,
        throttle,
      });
    }
  }
}

rows.sort((a, b) => a.route.localeCompare(b.route));

const classify = (r) => {
  if (r.guards.includes('AdminGuard') && !r.allowNonAdmin) return 'ADMIN';
  if (r.guards.includes('JwtAuthGuard')) return 'AUTH';
  if (r.guards.includes('OptionalAuthGuard')) return 'PUBLIC(+opt auth)';
  if (r.guards.includes('ApiKeyAuthGuard')) return 'API-KEY';
  return 'PUBLIC';
};

const counts = {};
for (const r of rows) {
  const level = classify(r);
  counts[level] = (counts[level] || 0) + 1;
  console.log(`${level.padEnd(18)} ${r.route.padEnd(52)} ${r.guards.join(',') || '-'}`);
}
console.log('\n--- totals ---');
console.log(counts);
console.log('total routes:', rows.length);
