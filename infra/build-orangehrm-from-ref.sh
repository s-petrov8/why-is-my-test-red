#!/usr/bin/env bash
# Builds a local OrangeHRM image from any commit or tag of an OrangeHRM repository,
# following the upstream build workflow. The repository defaults to upstream. The
# image carries the clone URL and the resolved commit as OCI source and revision labels.
# Usage: build-orangehrm-from-ref.sh <git-ref> <image-tag> [clone-url]
set -euo pipefail

ref="$1"
image="$2"
repo="${3:-https://github.com/orangehrm/orangehrm.git}"
source_dir="$(mktemp -d)"

echo "Cloning $repo at $ref"
git clone --quiet "$repo" "$source_dir"
git -C "$source_dir" checkout --quiet "$ref"
sha="$(git -C "$source_dir" rev-parse HEAD)"
echo "Resolved $ref to $sha"

# The PHP extensions live in the base image, not on the runner.
composer install --working-dir="$source_dir/src" --no-dev --ignore-platform-reqs --no-interaction --quiet
composer dump-autoload --working-dir="$source_dir/src" --optimize --no-dev --classmap-authoritative --ignore-platform-reqs --quiet

for client in src/client installer/client; do
    (cd "$source_dir/$client" && corepack yarn install && corepack yarn build)
done

docker build --quiet --tag "$image" \
    --label org.opencontainers.image.source="$repo" \
    --label org.opencontainers.image.revision="$sha" \
    --file "$(dirname "$0")/source-build.Dockerfile" "$source_dir"
