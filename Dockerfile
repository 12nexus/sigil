# ──────────────────────────────────────────────────────────────────────
# SIGIL — production image
#
# The runtime image carries only the standalone server bundle (no source,
# no dev dependencies, no build toolchain) and VectorCraft's command-line
# tool for vector tracing. Debian rather than Alpine: VectorCraft's Linux
# build is linked against glibc.
# ──────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time,
# so the model configuration has to be present here. These are model names
# and tuning numbers — never secrets. GEMINI_API_KEY is deliberately NOT a
# build argument: it is read only at runtime, on the server.
ARG NEXT_PUBLIC_GEMINI_TEXT_MODEL=gemini-3.8-flash
ARG NEXT_PUBLIC_GEMINI_REASONING_MODEL=gemini-3.8-flash
ARG NEXT_PUBLIC_GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
ARG NEXT_PUBLIC_GEMINI_FINALIST_IMAGE_MODEL=gemini-3-pro-image
ARG NEXT_PUBLIC_BATCH_CONCURRENCY=3
ARG NEXT_PUBLIC_MAX_RETRIES=2
ARG NEXT_PUBLIC_DEFAULT_DIRECTIONS=8
ARG NEXT_PUBLIC_DEFAULT_CONCEPTS_PER_DIRECTION=6
ARG NEXT_PUBLIC_DEFAULT_ITERATIONS=4
ARG NEXT_PUBLIC_IMAGE_ASPECT_RATIO=1:1

ENV NEXT_PUBLIC_GEMINI_TEXT_MODEL=$NEXT_PUBLIC_GEMINI_TEXT_MODEL \
    NEXT_PUBLIC_GEMINI_REASONING_MODEL=$NEXT_PUBLIC_GEMINI_REASONING_MODEL \
    NEXT_PUBLIC_GEMINI_IMAGE_MODEL=$NEXT_PUBLIC_GEMINI_IMAGE_MODEL \
    NEXT_PUBLIC_GEMINI_FINALIST_IMAGE_MODEL=$NEXT_PUBLIC_GEMINI_FINALIST_IMAGE_MODEL \
    NEXT_PUBLIC_BATCH_CONCURRENCY=$NEXT_PUBLIC_BATCH_CONCURRENCY \
    NEXT_PUBLIC_MAX_RETRIES=$NEXT_PUBLIC_MAX_RETRIES \
    NEXT_PUBLIC_DEFAULT_DIRECTIONS=$NEXT_PUBLIC_DEFAULT_DIRECTIONS \
    NEXT_PUBLIC_DEFAULT_CONCEPTS_PER_DIRECTION=$NEXT_PUBLIC_DEFAULT_CONCEPTS_PER_DIRECTION \
    NEXT_PUBLIC_DEFAULT_ITERATIONS=$NEXT_PUBLIC_DEFAULT_ITERATIONS \
    NEXT_PUBLIC_IMAGE_ASPECT_RATIO=$NEXT_PUBLIC_IMAGE_ASPECT_RATIO \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# VectorCraft (github.com/storytold/vectorcraft, MIT OR Apache-2.0): only its
# headless CLI, which traces on the CPU. Pinned by version and checksum; bump
# both together after checking a new release.
FROM debian:bookworm-slim AS vectorcraft
ARG VECTORCRAFT_VERSION=0.12.0
ARG VECTORCRAFT_SHA256=6750db109d3a253c51c82975af650f42384ba27a768f72529431edfb58508269
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
RUN set -eu; \
    name="vectorcraft-${VECTORCRAFT_VERSION}-linux-x86_64"; \
    curl -fsSL -o /tmp/vc.tar.gz \
      "https://github.com/storytold/vectorcraft/releases/download/v${VECTORCRAFT_VERSION}/${name}.tar.gz"; \
    echo "${VECTORCRAFT_SHA256}  /tmp/vc.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/vc.tar.gz -C /tmp "${name}/bin/vectorcraft-cli" "${name}/share/doc/vectorcraft"; \
    install -D -m 0755 "/tmp/${name}/bin/vectorcraft-cli" /out/bin/vectorcraft-cli; \
    mkdir -p /out/doc; \
    cp -r "/tmp/${name}/share/doc/vectorcraft" /out/doc/; \
    rm -rf /tmp/vc.tar.gz "/tmp/${name}"


FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3210 \
    HOSTNAME=0.0.0.0

RUN groupadd -g 1001 nodejs && useradd -r -u 1001 -g nodejs -d /app sigil

COPY --from=vectorcraft /out/bin/vectorcraft-cli /usr/local/bin/vectorcraft-cli
COPY --from=vectorcraft /out/doc/vectorcraft /usr/share/doc/vectorcraft

COPY --from=builder /app/public ./public
COPY --from=builder --chown=sigil:nodejs /app/.next/standalone ./
COPY --from=builder --chown=sigil:nodejs /app/.next/static ./.next/static

USER sigil
EXPOSE 3210

# The status route needs no API call, so it is a true liveness signal.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3210/api/gemini/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
