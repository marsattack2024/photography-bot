#!/bin/bash

# Unset any existing OpenAI environment variables
unset OPENAI_API_KEY
unset OPENAI_API_BASE_PATH
unset OPENAI_ORG_ID
unset OPENAI_PROJECT_ID
unset OPENAI_MODEL

# Load environment from .env file
export $(cat .env | grep -v '^#' | xargs)

# Start the bot
npm run dev 