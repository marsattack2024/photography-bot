#!/bin/bash

# Function to clean environment variables
clean_env() {
    # List of variables to clean
    local vars=(
        OPENAI_API_KEY
        OPENAI_API_BASE_PATH
        OPENAI_ORG_ID
        OPENAI_PROJECT_ID
        OPENAI_MODEL
        DISCORD_BOT_TOKEN
        DISCORD_CLIENT_ID
        DISCORD_GUILD_ID
        DISCORD_BOT_PREFIX
    )

    # Unset each variable
    for var in "${vars[@]}"; do
        unset "$var"
    done
}

# Clean the environment
clean_env

# Print current working directory
echo "Current directory: $(pwd)"

# Load only essential environment variables
export PATH="$PATH"
export HOME="$HOME"
export USER="$USER"
export SHELL="$SHELL"
export npm_config_prefix="$npm_config_prefix"
export NODE="$NODE"
export npm_node_execpath="$npm_node_execpath"

# Source .env file
if [ -f .env ]; then
    echo "Loading environment from .env file..."
    set -a
    source .env
    set +a
else
    echo "Error: .env file not found!"
    exit 1
fi

# Verify environment
echo "Verifying environment..."
echo "OpenAI API Key (last 4): ${OPENAI_API_KEY: -4}"
echo "OpenAI Project ID: $OPENAI_PROJECT_ID"
echo "OpenAI Base Path: $OPENAI_API_BASE_PATH"
echo "Discord Bot Token exists: $([ -n "$DISCORD_BOT_TOKEN" ] && echo "Yes" || echo "No")"

# Start the bot
echo "Starting bot..."
npm run dev 