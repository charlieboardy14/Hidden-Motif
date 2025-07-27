set -x
tsc -p tsconfig.server.json
mv dist-server/server/server.js dist-server/server/server.cjs
chmod +x dist-server/server/server.cjs