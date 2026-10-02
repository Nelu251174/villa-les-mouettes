#!/bin/bash
# Se ruleaza O SINGURA DATA pe server: instaleaza actualizarea automata la 5 minute.
set -euo pipefail
chmod +x /opt/villa/deploy/update.sh
cat > /etc/systemd/system/villa-update.service <<'EOF'
[Unit]
Description=Villa Les Mouettes auto-update

[Service]
Type=oneshot
ExecStart=/usr/bin/flock -n /run/villa-update.lock /opt/villa/deploy/update.sh
EOF
cat > /etc/systemd/system/villa-update.timer <<'EOF'
[Unit]
Description=Villa Les Mouettes auto-update every 5 minutes

[Timer]
OnBootSec=3min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now villa-update.timer
systemctl start --no-block villa-update.service
echo "AUTOUPDATE-OK"
