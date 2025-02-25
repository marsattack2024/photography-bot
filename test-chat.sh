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
        SUPABASE_URL
        SUPABASE_KEY
        SUPABASE_ANON_KEY
    )

    # Unset each variable
    for var in "${vars[@]}"; do
        echo "Unsetting $var"
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
echo "Supabase URL exists: $([ -n "$SUPABASE_URL" ] && echo "Yes" || echo "No")"
echo "Supabase Key exists: $([ -n "$SUPABASE_KEY" ] && echo "Yes" || echo "No")"

# Run the test
echo "Running chat functionality test..."
NODE_ENV=test npx ts-node src/test-chat.ts 