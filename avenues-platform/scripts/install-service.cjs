const path = require('path');

let Service;
try {
  ({ Service } = require('node-windows'));
} catch (error) {
  console.error('node-windows is required to install the watcher service.');
  console.error('Install it first with: npm install -g node-windows');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const scriptPath = path.join(__dirname, 'run-file-watcher.cjs');
const appName = process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || 'MIL Analytics Dashboard';

const svc = new Service({
  name: process.env.WATCHER_SERVICE_NAME || 'MilAnalyticsFileWatcher',
  description: `Monitors CSV uploads and ingests them into ${appName}.`,
  script: scriptPath,
  workingDirectory: rootDir,
  wait: 2,
  grow: 0.5,
  maxRestarts: 3,
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'WATCHER_ROOT', value: rootDir },
  ],
});

svc.on('install', () => {
  console.log('Service installed successfully.');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Service is already installed.');
});

svc.on('start', () => {
  console.log('Service started.');
});

svc.on('error', (error) => {
  console.error('Service installation failed:', error);
  process.exitCode = 1;
});

svc.install();
