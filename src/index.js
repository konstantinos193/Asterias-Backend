// Entry point for Render deployment
// Ensure dependencies are installed before starting
const { execSync } = require('child_process');

try {
  console.log('Installing dependencies...');
  execSync('npm install --production', { stdio: 'inherit' });
  console.log('Dependencies installed successfully');
} catch (error) {
  console.error('Failed to install dependencies:', error.message);
  // Continue anyway - dependencies might already be installed
}

// Start the compiled application directly
require('../dist/main.js');
