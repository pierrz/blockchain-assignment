#!/bin/sh

if [ "${BUILD_ONLY}" = "True" ]; then
    echo "Dist package built."
    sleep 1m
    exit 0

else
    echo "Running in $(echo $NODE_ENV | tr '[:lower:]' '[:upper:]') mode"

    if [ "${NODE_ENV}" = "production" ]; then
        exec npm start
    else
        # Not working yet (error: Must use import to load ES Module: /src/index.ts)
        npm ci
        exec npm run dev
    fi

fi
