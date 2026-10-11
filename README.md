# Clinic Database

See `SPEC.md` (what we build) and `CHANGELOG.md` (what changed).

## Run on the laptop

First time only:

    cp .env.example .env      # then set a real POSTGRES_PASSWORD (openssl rand -hex 24)

Start / stop:

    podman compose up -d --build -V
    podman compose down

Open http://localhost:3000

See the app's log:

    podman compose logs -f app
