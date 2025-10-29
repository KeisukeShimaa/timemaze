#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -euo pipefail

HARDHAT_NODE_PORT=8545
HARDHAT_NODE_HOST=127.0.0.1
HARDHAT_NODE_URL="http://${HARDHAT_NODE_HOST}:${HARDHAT_NODE_PORT}"
TIMEOUT_SECONDS=60
CHECK_INTERVAL_SECONDS=1

cd "${SCRIPT_DIR}/../../fhevm-hardhat-template"

echo "--- Starting Hardhat Node in background ---"
npx hardhat node &> /dev/null &
HARDHAT_PID_ROOT=$!

echo "Hardhat Node started with PID: $HARDHAT_PID_ROOT. Waiting for it to be ready..."
ATTEMPTS=0
while [ $ATTEMPTS -lt $TIMEOUT_SECONDS ]; do
    if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$HARDHAT_NODE_URL" > /dev/null 2>&1; then
        echo "Hardhat Node is ready!"
        break
    fi
    echo "Waiting for Hardhat Node... (Attempt $((ATTEMPTS+1))/$TIMEOUT_SECONDS)"
    sleep "$CHECK_INTERVAL_SECONDS"
    ATTEMPTS=$((ATTEMPTS+1))
done

HARDHAT_PID=$(lsof -i :${HARDHAT_NODE_PORT} -t || true)

if [ $ATTEMPTS -eq $TIMEOUT_SECONDS ]; then
    echo "Error: Hardhat Node did not start within $TIMEOUT_SECONDS seconds."
    kill "$HARDHAT_PID_ROOT" || true
    [ -n "$HARDHAT_PID" ] && kill "$HARDHAT_PID" || true
    exit 1
fi

echo "--- Deploying TimeMaze.sol on Hardhat Node ---"
npx hardhat deploy --network localhost || true

echo "--- Shutting down Hardhat Node ---"
kill "$HARDHAT_PID_ROOT" || true
[ -n "$HARDHAT_PID" ] && kill "$HARDHAT_PID" || true
sleep 1

exit 0



