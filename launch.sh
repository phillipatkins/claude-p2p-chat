#!/bin/bash
# Claude Chat launcher — cross-platform (Linux, macOS, Windows/WSL)
CHAT_DIR="$(dirname "$(realpath "$0")")"
CHAT_CMD="node $CHAT_DIR/chat.js"

OS="$(uname -s)"

case "$OS" in
  Linux*)
    if command -v gnome-terminal &>/dev/null; then
      gnome-terminal --window --title="Claude Chat" -- bash -c "$CHAT_CMD; exec bash" 2>/dev/null &
    elif command -v xfce4-terminal &>/dev/null; then
      xfce4-terminal --title="Claude Chat" -e "bash -c '$CHAT_CMD; exec bash'" 2>/dev/null &
    elif command -v konsole &>/dev/null; then
      konsole --title "Claude Chat" -e bash -c "$CHAT_CMD; exec bash" 2>/dev/null &
    elif command -v x-terminal-emulator &>/dev/null; then
      x-terminal-emulator -e bash -c "$CHAT_CMD; exec bash" 2>/dev/null &
    else
      echo "error: no terminal emulator found"
      exit 1
    fi
    ;;
  Darwin*)
    osascript -e "tell application \"Terminal\" to do script \"$CHAT_CMD\"" 2>/dev/null
    ;;
  MINGW*|MSYS*|CYGWIN*)
    cmd.exe /c start cmd /k "$CHAT_CMD" 2>/dev/null &
    ;;
  *)
    echo "error: unsupported OS ($OS)"
    exit 1
    ;;
esac

echo "opened"
