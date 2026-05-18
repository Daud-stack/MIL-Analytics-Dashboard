# File Watcher Setup Guide

This is the current setup guide for the watcher scripts in this repo.

## Entry points

- Manual run: `npm run watch:files`
- Node bootstrap: `node scripts/run-file-watcher.cjs`
- Install Windows service: `npm run watch:files:service:install`
- Uninstall Windows service: `npm run watch:files:service:uninstall`

## Environment

1. Copy `.env.watcher.example` to `.env.watcher`.
2. Fill in:
   - `API_URL`
   - `INGEST_API_KEY`
   - `ORG_ID`
   - `WATCH_DIR`
   - `ARCHIVE_DIR`
   - `POLL_MS`

The watcher loads `.env.watcher` automatically when it starts.

Current local drop-folder configuration:

```powershell
WATCH_DIR=C:\Users\daud\AppData\Roaming\Microsoft\Windows\Network Shortcuts\Analytics System Drop Folder
ARCHIVE_DIR=C:\Users\daud\AppData\Roaming\Microsoft\Windows\Network Shortcuts\Analytics System Drop Folder\Archived
```

## Behavior

- `Dashboard`, `Location`, and `Claims` CSV schemas are ingested with their domain-specific parsers.
- Any other CSV schema is profiled as a generic dataset and stored in `YearDataRecord.datasets`.
- Duplicate files are detected by SHA-256 hash and archived with the `_dup` suffix.
- Processed files are moved to `ARCHIVE_DIR`.

## Windows service flow

1. Install `node-windows` on the server:
   - `npm install -g node-windows`
2. Run:
   - `npm run watch:files:service:install`
3. Check service status:
   - `Get-Service -Name "AvenuesClinicalFileWatcher"`

To remove the service later:
- `npm run watch:files:service:uninstall`

## Notes

- The service runs `scripts/run-file-watcher.cjs`, which bootstraps the TypeScript watcher through `tsx`.
- The active watcher implementation is `scripts/file-watcher-main.ts`.
