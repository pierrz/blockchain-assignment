#!/bin/sh

echo "Running in $(echo $NODE_ENV | tr '[:lower:]' '[:upper:]') mode"

if [ "${NODE_ENV}" = "production" ]; then
    exec npm start
else
    # Not working yet (error: Must use import to load ES Module: /src/index.ts)
    npm ci
    exec npm run dev
fi
