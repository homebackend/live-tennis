#!/usr/bin/env bash
set -e

# install using
# bash <(curl -sL https://githubusercontent.com)

REPO_USER='homebackend'
REPO_NAME='live-tennis'
EXT_NAME='live-tennis-gnome-extension'
ZIP_URL="https://github.com${REPO_USER}/${REPO_NAME}/releases/latest/download/${EXT_NAME}.zip"
TMP_ZIP="/tmp/gnome-extension.zip"

echo "Downloading GNOME extension..."
curl -L -o "$TMP_ZIP" "$ZIP_URL"

echo "Installing extension..."
gnome-extensions install "$TMP_ZIP"

# Cleanup
rm -f "$TMP_ZIP"

echo "Extension installed successfully! Please restart GNOME Shell or log out/in to enable it."
