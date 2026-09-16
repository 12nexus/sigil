# ──────────────────────────────────────────────────────────────────────
# SIGIL — production image
#
# Three stages so the runtime image carries only the standalone server
# bundle: no source, no dev dependencies, no build toolchain.
# ──────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci


FROM node:22-alpine AS builder
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


FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3210 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs sigil

COPY --from=builder /app/public ./public
COPY --from=builder --chown=sigil:nodejs /app/.next/standalone ./
COPY --from=builder --chown=sigil:nodejs /app/.next/static ./.next/static

USER sigil
EXPOSE 3210

# The status route needs no API call, so it is a true liveness signal.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3210/api/gemini/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
