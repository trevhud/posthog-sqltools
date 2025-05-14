#!/bin/bash

# Install script for PostHog ClickHouse Query Runner

echo "Installing PostHog ClickHouse Query Runner..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# Run the Python setup script
python3 "$SCRIPT_DIR/setup.py"

# Make the script executable if it's not already
chmod +x "$SCRIPT_DIR/setup.py"

echo "Installation complete!"
