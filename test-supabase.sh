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

# Run the test
echo "Running Supabase test..."
npx ts-node src/test-supabase.ts 