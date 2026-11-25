#!/bin/bash
set -e

echo "=== Harness Initialization ==="

echo "=== npm run lint ==="
npm run lint

echo "=== npm run build ==="
npm run build

echo "=== npm test ==="
npm test

echo "=== Verification Complete ==="
