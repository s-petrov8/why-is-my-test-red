#!/usr/bin/env bash
# Builds a local OrangeHRM image from any upstream commit or tag, following the
# upstream build workflow. Usage: build-orangehrm-from-ref.sh <git-ref> <image-tag>
set -euo pipefail

ref="$1"
image="$2"
source_dir="$(mktemp -d)"

git clone --quiet https://github.com/orangehrm/orangehrm.git "$source_dir"
git -C "$source_dir" checkout --quiet "$ref"

# The PHP extensions live in the base image, not on the runner.
composer install --working-dir="$source_dir/src" --no-dev --ignore-platform-reqs --no-interaction --quiet
composer dump-autoload --working-dir="$source_dir/src" --optimize --no-dev --classmap-authoritative --ignore-platform-reqs --quiet

for client in src/client installer/client; do
    (cd "$source_dir/$client" && corepack yarn install && corepack yarn build)
done

docker build --quiet --tag "$image" --file "$(dirname "$0")/source-build.Dockerfile" "$source_dir"
