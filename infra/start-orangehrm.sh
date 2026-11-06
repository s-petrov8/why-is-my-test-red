#!/usr/bin/env bash
# Starts OrangeHRM, installs it unattended and waits until the login page answers.
# Requires DB_ROOT_PASSWORD, ADMIN_USERNAME and ADMIN_PASSWORD in the environment.
set -euo pipefail

cd "$(dirname "$0")"

envsubst '${DB_ROOT_PASSWORD} ${ADMIN_USERNAME} ${ADMIN_PASSWORD}' \
    < cli_install_config.template.yaml > cli_install_config.yaml

docker compose up -d --wait db
docker compose up -d app

docker compose exec -T app php installer/cli_install.php

# The image owns these as www-data; the installer ran as root.
docker compose exec -T app chown -R www-data:www-data lib/confs src/cache src/log src/config

if [[ "${OHRM_DEBUG:-false}" == "true" ]]; then
    docker compose exec -T app sed -i "s/\$env = 'prod';/\$env = 'dev';/" web/index.php
fi

for _ in $(seq 1 30); do
    status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/web/index.php/auth/login || true)
    if [[ "$status" == "200" ]]; then
        echo "OrangeHRM is ready"
        exit 0
    fi
    sleep 2
done

echo "OrangeHRM did not answer on /auth/login; last status: $status" >&2
exit 1
