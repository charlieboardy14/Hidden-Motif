set -x
tsc -p tsconfig.server.json
find dist-server -name "*.js" -exec sh -c 'mv "$0" "${0%.js}.cjs"' {} \;
chmod +x dist-server/server/server.cjs