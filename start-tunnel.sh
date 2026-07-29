#!/bin/bash
# Starts the serveo tunnel to expose the local backend

tmux kill-session -t tunnel 2>/dev/null
tmux new-session -d -s tunnel
tmux send-keys -t tunnel "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R 80:localhost:3001 serveo.net" Enter
sleep 5
cat /tmp/tunnel.log
echo "Tunnel URL:"
grep -oP 'https://[^\s]+' /tmp/tunnel.log | head -1
