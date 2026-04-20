#!/usr/bin/env bash
set -e

BOLD=$(tput bold 2>/dev/null || echo "")
RESET=$(tput sgr0 2>/dev/null || echo "")
GREEN=$(tput setaf 2 2>/dev/null || echo "")
RED=$(tput setaf 1 2>/dev/null || echo "")

echo ""
echo "${BOLD}Resolvent — quick setup${RESET}"
echo "────────────────────────"

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "${RED}Error: Docker is not installed.${RESET}"
  echo "Install it from https://www.docker.com/products/docker-desktop and re-run this script."
  exit 1
fi

if ! docker info &>/dev/null; then
  echo "${RED}Error: Docker is not running.${RESET}"
  echo "Start Docker Desktop and re-run this script."
  exit 1
fi

# Create .env if missing
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
fi

# Prompt for API key if not already set
if ! grep -qE "^ANTHROPIC_API_KEY=sk-[^.]{10}" backend/.env 2>/dev/null; then
  echo ""
  echo "Enter your Anthropic API key (starts with sk-ant-):"
  read -r api_key
  # Replace or append the key
  if grep -q "^ANTHROPIC_API_KEY=" backend/.env; then
    sed -i.bak "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${api_key}|" backend/.env && rm -f backend/.env.bak
  else
    echo "ANTHROPIC_API_KEY=${api_key}" >> backend/.env
  fi
fi

# Generate SECRET_KEY if placeholder
if grep -q "^SECRET_KEY=change-me\|^SECRET_KEY=$\|^SECRET_KEY=your-" backend/.env 2>/dev/null || ! grep -q "^SECRET_KEY=" backend/.env 2>/dev/null; then
  secret=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48 || true)
  if [ -z "$secret" ]; then
    secret=$(python3 -c "import secrets; print(secrets.token_urlsafe(36))")
  fi
  if grep -q "^SECRET_KEY=" backend/.env; then
    sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=${secret}|" backend/.env && rm -f backend/.env.bak
  else
    echo "SECRET_KEY=${secret}" >> backend/.env
  fi
fi


echo ""
echo "Starting Resolvent..."
docker compose up -d --build

echo ""
echo "${GREEN}${BOLD}Done!${RESET}"
echo ""
echo "  Local:    http://localhost:3000"
echo "  Network:  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo '<host-ip>'):3000"
echo ""

# Open browser
if command -v open &>/dev/null; then
  open http://localhost:3000
elif command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000
fi
