// Entry point for Render deployment
// First try to run the build, then start the application
const { execSync } = require('child_process');

try {
  console.log('Building NestJS application...');
  execSync('npm run build:render', { stdio: 'inherit' });
  console.log('Build completed successfully');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

// Start the compiled application
require('../dist/main.js');
