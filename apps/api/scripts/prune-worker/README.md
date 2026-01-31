# Prune Worker

Standalone cleanup worker for Buddy Wallet API database maintenance.

## Usage

### Local Development

```bash
cd apps/api
bun run scripts/prune-worker/index.ts
```

### Production Deployment (Linux with Systemd)

1. Copy the systemd files to the system directory:

```bash
sudo cp scripts/prune-worker/buddy-cleanup.service /etc/systemd/system/
sudo cp scripts/prune-worker/buddy-cleanup.timer /etc/systemd/system/
```

2. Reload systemd and enable the timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable buddy-cleanup.timer
sudo systemctl start buddy-cleanup.timer
```

3. Verify timer is active:

```bash
systemctl list-timers | grep buddy
```

4. View logs:

```bash
journalctl -u buddy-cleanup.service
```

## Configuration

Edit `buddy-cleanup.timer` to change the schedule:

- `OnCalendar=*-*-* 03:00:00` - Runs daily at 3:00 AM
- `RandomizedDelaySec=600` - Random delay up to 10 minutes

Edit `buddy-cleanup.service` to adjust:

- `User=buddy` - User to run as
- `WorkingDirectory=/app` - Application directory
