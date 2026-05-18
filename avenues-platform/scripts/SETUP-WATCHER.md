# File Watcher Setup Guide

This guide walks through setting up and running the CSV File Watcher on a Windows Server.

The file watcher monitors a shared network folder for new CSV files, auto-detects their type (Dashboard, Location, or Claims), parses them, and POSTs the parsed data to the configured app API using machine-to-machine authentication.

---

## Prerequisites

- **Windows Server 2016+** (tested on Windows Server 2019, 2022)
- **Administrator access** to install Node.js and configure Windows Services
- **Network access** to:
  - The shared folder where CSV files are dropped
  - Your deployed app API endpoint
- **Organization ID and API Key** from your dashboard administrator

---

## Step 1: Install Node.js on Windows Server

1. **Download Node.js LTS**
   - Go to https://nodejs.org (download the LTS version, currently v20.x)
   - Choose the `.msi` installer for Windows (64-bit recommended)

2. **Install Node.js**
   - Run the installer and follow the wizard
   - Accept the default installation path (`C:\Program Files\nodejs`)
   - Check the box "Add Node.js to PATH" during installation
   - Check the box "Automatically install the necessary tools for native modules"
   - Complete the installation

3. **Verify Installation**
   - Open PowerShell or Command Prompt (run as Administrator)
   - Run:
     ```
     node --version
     npm --version
     ```
   - Both commands should display version numbers (e.g., `v20.x.x`)

---

## Step 2: Clone or Copy the Repository

You have two options:

### Option A: Clone from Git (recommended if Git is available)

```powershell
cd C:\
git clone https://github.com/avenues-clinic/analytics-dashboard avenues-platform
cd avenues-platform
npm install
```

### Option B: Copy the Scripts Folder

If you don't have Git, copy just the scripts folder:

1. Copy the `scripts/` folder and `package.json` to `C:\avenues-platform\`
2. Copy `src/lib/parsers.ts` and `src/lib/generic-parser.ts` to the correct relative paths
3. Navigate to the folder and run:
   ```
   npm install
   ```

---

## Step 3: Set Up Environment Configuration

1. **Create `.env.watcher` file**
   - Copy `.env.watcher.example` to `.env.watcher` in the project root
   - Or manually create `C:\avenues-platform\.env.watcher`

2. **Fill in the configuration**
   ```
   API_URL=https://your-dashboard.example.com
   INGEST_API_KEY=your-secret-api-key-here
   ORG_ID=your-org-id-here
   WATCH_DIR=C:\AnalyticsDashboard\SharedData\CSVDropFolder
   ARCHIVE_DIR=C:\AnalyticsDashboard\SharedData\Archived
   POLL_MS=3000
   ```

3. **Get your credentials**
   - **INGEST_API_KEY**: Contact your dashboard administrator. This is a secure API key set in the deployment environment.
   - **ORG_ID**: Available in your dashboard account or database. Ask your administrator if unsure.

4. **Update the paths**
   - **WATCH_DIR**: The shared network folder where users will drop CSV files
   - **ARCHIVE_DIR**: A folder where processed files will be moved (can be on the same or different network drive)

---

## Step 4: Create the Shared Folders

On the shared network storage or local server:

1. **Create the drop folder**
   - `C:\AnalyticsDashboard\SharedData\CSVDropFolder` (or your chosen path)
   - Set NTFS permissions:
     - Assign read/write access to clinic users
     - Assign full access to the Windows service account (see Step 5)

2. **Create the archive folder**
   - `C:\AnalyticsDashboard\SharedData\Archived` (or your chosen path)
   - This folder will store processed files with timestamps

3. **Create a README for users**
   - In the drop folder, create a `README.txt` with instructions for uploading files:
     ```
     Analytics Dashboard CSV Upload Folder
     =================================
     
     Instructions:
     1. Prepare your CSV file with the correct format (Dashboard, Location, or Claims)
     2. Drop the file into this folder
     3. The file will be automatically processed within 30 seconds
     4. Once processed, the file will move to the Archive folder
     5. Check the dashboard to view your uploaded data
     
     Supported file types:
     - Dashboard CSV (Admissions, Discharges, Revenue, etc.)
     - Location CSV (Episodes, Doctors, Specialties)
     - Claims CSV (Insurance claims, EDI status, etc.)
     
     File naming: Use descriptive names like "Dashboard_2024_Q1.csv"
     ```

---

## Step 5: Test the File Watcher (Manual)

Before setting up as a service, test it manually:

1. **Open PowerShell as Administrator**
   ```powershell
   cd C:\avenues-platform
   ```

2. **Load the environment variables**
   ```powershell
   # Create a temporary .env file or set variables manually
   $env:API_URL = "https://your-dashboard.example.com"
   $env:INGEST_API_KEY = "your-key-here"
   $env:ORG_ID = "your-org-id"
   $env:WATCH_DIR = "C:\AnalyticsDashboard\SharedData\CSVDropFolder"
   $env:ARCHIVE_DIR = "C:\AnalyticsDashboard\SharedData\Archived"
   $env:POLL_MS = "3000"
   ```

3. **Run the watcher**
   ```powershell
   npx tsx scripts/file-watcher-main.ts
   ```

4. **Test with a CSV file**
   - Copy a test CSV file to the WATCH_DIR
   - The watcher should detect it and process it
   - You should see output like:
     ```
     🆕 New file detected: test.csv
     📄 Processing: test.csv
     Type detected: Dashboard
     Posting to https://your-dashboard.example.com/api/data/ingest...
     ✅ Ingested: test.csv → year 2024 (Dashboard)
     📦 Archived: 2024-04-10T15-30-45_test.csv
     ```

5. **Verify the data**
   - Log in to the dashboard
   - Check that your data appears in the system

6. **Stop the watcher**
   - Press `Ctrl+C` in the PowerShell window

---

## Step 6: Install as a Windows Service

Once manual testing succeeds, you can install the watcher as a Windows Service to run automatically.

### Option A: Using node-windows (Recommended)

1. **Install node-windows globally**
   ```powershell
   npm install -g node-windows
   ```

2. **Create a service installer script** (`scripts/install-service.js`)
   ```javascript
   const Service = require('node-windows').Service;
   const path = require('path');

   // Create a new service
   const svc = new Service({
     name: 'MilAnalyticsFileWatcher',
     description: 'Monitors CSV uploads and ingests to the analytics dashboard',
     script: path.join(__dirname, 'file-watcher-main.ts'),
     scriptOptions: '--no-deprecation',
     nodeOptions: ['--no-warnings'],
     env: {
       name: 'NODE_ENV',
       value: 'production',
     },
     envFile: path.join(__dirname, '..', '.env.watcher'),
   });

   svc.on('install', () => {
     svc.start();
     console.log('✅ Service installed and started');
   });

   svc.install();
   ```

3. **Run the installer** (as Administrator)
   ```powershell
   cd C:\avenues-platform
   node scripts/install-service.js
   ```

4. **Verify the service is running**
   ```powershell
   Get-Service -Name "AvenuesClinicalFileWatcher" | Select-Object Status
   ```

### Option B: Using NSSM (Non-Sucking Service Manager)

If node-windows doesn't work, use NSSM:

1. **Download NSSM**
   - Download from https://nssm.cc/download
   - Extract to `C:\nssm\` (or add to PATH)

2. **Create the service**
   ```powershell
   cd C:\nssm\win64
   .\nssm.exe install AvenuesClinicalFileWatcher "C:\Program Files\nodejs\node.exe" "C:\avenues-platform\node_modules\.bin\tsx C:\avenues-platform\scripts\file-watcher-main.ts"
   ```

3. **Configure environment file**
   - In the NSSM GUI, go to "Environment" tab
   - Add the environment variables or point to `.env.watcher`

4. **Set the working directory**
   - In the NSSM GUI, set "App tab" → "Startup directory" to `C:\avenues-platform`

5. **Start the service**
   ```powershell
   Start-Service -Name "AvenuesClinicalFileWatcher"
   ```

---

## Step 7: Monitor and Maintain

### Check Service Status

```powershell
# Check if running
Get-Service -Name "AvenuesClinicalFileWatcher"

# View recent logs (if using node-windows)
Get-Content "C:\Users\[ServiceAccount]\AppData\Roaming\node-windows\logs\AvenuesClinicalFileWatcher.log" -Tail 50
```

### Restart the Service

```powershell
Restart-Service -Name "AvenuesClinicalFileWatcher"
```

### Stop the Service

```powershell
Stop-Service -Name "AvenuesClinicalFileWatcher"
```

### Uninstall the Service

```powershell
# Using node-windows (run uninstall script from your installation)
# Or using Services app: right-click → Delete

# Using NSSM:
cd C:\nssm\win64
.\nssm.exe remove AvenuesClinicalFileWatcher confirm
```

### View Service Logs

- **Event Viewer** → Windows Logs → Application
- Look for entries from Node.js or the service name
- Or check the logs in `C:\avenues-platform\logs\` if configured

---

## Step 8: Configure Network Permissions

Ensure the service account has proper access:

1. **Right-click WATCH_DIR** → Properties → Security → Edit
   - Add the service account (or NETWORK SERVICE if running as local system)
   - Grant "Modify" and "Write" permissions

2. **Same for ARCHIVE_DIR**

3. **For network shares**, grant access at both:
   - The share level (right-click share → Permissions)
   - The NTFS level (right-click folder → Security)

---

## Troubleshooting

### Service won't start

1. **Check service status**
   ```powershell
   Get-Service -Name "AvenuesClinicalFileWatcher" | Get-Member
   ```

2. **Check Event Viewer for errors**
   - Event Viewer → Windows Logs → Application

3. **Run manually to see detailed errors**
   ```powershell
   cd C:\avenues-platform
   npx tsx scripts/file-watcher-main.ts
   ```

### Files not being detected

1. **Verify file is actually in WATCH_DIR**
   ```powershell
   Get-ChildItem C:\AvenuesClinic\SharedData\CSVDropFolder
   ```

2. **Check file permissions** — service account must have read access

3. **Increase POLL_MS** if on a slow network
   ```
   POLL_MS=5000
   ```

### API authentication errors

1. **Verify INGEST_API_KEY is correct**
   - Check with your administrator
   - Ensure it matches the server-side `INGEST_API_KEY` environment variable

2. **Verify ORG_ID exists**
   - Check the database: `SELECT id FROM organizations`

3. **Test API connectivity**
   ```powershell
   curl -X GET "https://your-dashboard.example.com/api/health"
   ```

### Files being archived as "dup" or "error"

1. **SHA-256 duplicate**
   - Same file content was already uploaded
   - Check the archive folder and database to verify

2. **Parse error**
   - CSV format may not match expected format
   - Check the error logs for details

3. **API error**
   - Network connectivity issue
   - API credentials incorrect
   - Organization doesn't exist

---

## Security Best Practices

1. **Protect .env.watcher**
   - Store in a secure location
   - Restrict file access to the service account only
   - Never commit to version control

2. **Rotate API keys periodically**
   - Change `INGEST_API_KEY` every 90 days
   - Update on the Vercel project settings
   - Update in `.env.watcher` on the server

3. **Monitor processed files**
   - Regularly review the archive folder
   - Verify data appears in the dashboard
   - Monitor for unusual patterns

4. **Log retention**
   - Implement log rotation if storing verbose logs
   - Archive old logs regularly
   - Don't store logs in the same folder as active code

---

## Support

For issues or questions:
1. Check the logs in Event Viewer or the application logs
2. Verify all environment variables in `.env.watcher`
3. Test manually before deploying as a service
4. Contact your dashboard administrator for API key issues

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npx tsx scripts/file-watcher-main.ts` | Run watcher manually |
| `Start-Service -Name AvenuesClinicalFileWatcher` | Start service |
| `Stop-Service -Name AvenuesClinicalFileWatcher` | Stop service |
| `Restart-Service -Name AvenuesClinicalFileWatcher` | Restart service |
| `Get-Service -Name AvenuesClinicalFileWatcher` | Check status |

---

**Version 1.0** — Updated April 2024
