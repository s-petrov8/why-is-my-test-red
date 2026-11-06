# The release image supplies Apache, PHP and its extensions; the application
# files come from the source tree this image is built from.
FROM orangehrm/orangehrm:5.9

RUN find /var/www/html -mindepth 1 -delete
COPY . /var/www/html/
RUN rm -rf /var/www/html/.git \
    && chown -R www-data:www-data /var/www/html/lib/confs /var/www/html/src/cache /var/www/html/src/log /var/www/html/src/config
