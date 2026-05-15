let Service;
try {
  ({ Service } = require('node-windows'));
} catch (error) {
  console.error('node-windows is required to uninstall the watcher service.');
  console.error('Install it first with: npm install -g node-windows');
  process.exit(1);
}

const svc = new Service({
  name: 'AvenuesClinicalFileWatcher',
  script: require('path').join(__dirname, 'run-file-watcher.cjs'),
});

svc.on('uninstall', () => {
  console.log('Service uninstalled successfully.');
});

svc.on('alreadyuninstalled', () => {
  console.log('Service is already uninstalled.');
});

svc.on('error', (error) => {
  console.error('Service uninstall failed:', error);
  process.exitCode = 1;
});

svc.uninstall();
