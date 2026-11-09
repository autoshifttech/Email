FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
RUN mkdir -p /app/data
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
# Creates/updates the SQLite schema, then runs the web app + the IMAP worker together.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start:all"]
