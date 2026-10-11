# Nightly encrypted database backups. Same PostgreSQL version as the database.
FROM docker.io/library/postgres:18-alpine
RUN apk add --no-cache age tzdata
ENV TZ=Europe/Athens
COPY *.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh
ENTRYPOINT []
CMD ["start.sh"]
