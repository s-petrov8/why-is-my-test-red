#!/usr/bin/env bash
# Starts OrangeHRM, installs it unattended and waits until the login page answers.
# Requires DB_ROOT_PASSWORD, ADMIN_USERNAME and ADMIN_PASSWORD in the environment.
# COMPOSE_PROJECT_NAME and OHRM_PORT (default 8080) tell instances apart; see the README.
set -euo pipefail

cd "$(dirname "$0")"

# Without a project name every checkout is the project "infra", so a second
# instance would replace the first one's containers while its suite runs.
if [[ "${OHRM_PORT:-8080}" != "8080" && -z "${COMPOSE_PROJECT_NAME:-}" ]]; then
    echo "OHRM_PORT=$OHRM_PORT needs COMPOSE_PROJECT_NAME too, or this instance would replace another one's containers." >&2
    echo "For example: COMPOSE_PROJECT_NAME=ohrm-b OHRM_PORT=$OHRM_PORT infra/start-orangehrm.sh" >&2
    exit 1
fi

# The rendered config holds credentials and belongs to one instance, so it lives
# in a private temp file and is copied into that instance's container.
install_config="$(mktemp)"
trap 'rm -f "$install_config"' EXIT

envsubst '${DB_ROOT_PASSWORD} ${ADMIN_USERNAME} ${ADMIN_PASSWORD}' \
    < cli_install_config.template.yaml > "$install_config"

docker compose up -d --wait db
docker compose up -d app

docker compose cp "$install_config" app:/var/www/html/installer/cli_install_config.yaml
docker compose exec -T app php installer/cli_install.php

# The image owns these as www-data; the installer ran as root.
docker compose exec -T app chown -R www-data:www-data lib/confs src/cache src/log src/config

if [[ "${OHRM_DEBUG:-false}" == "true" ]]; then
    docker compose exec -T app sed -i "s/\$env = 'prod';/\$env = 'dev';/" web/index.php
fi

for _ in $(seq 1 30); do
    status=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${OHRM_PORT:-8080}/web/index.php/auth/login" || true)
    if [[ "$status" == "200" ]]; then
        echo "OrangeHRM is ready"
        exit 0
    fi
    sleep 2
done

echo "OrangeHRM did not answer on /auth/login; last status: $status" >&2
exit 1
