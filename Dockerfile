# One source tree, one image per surface.
#
#   docker build --build-arg TELEMED_SURFACE=patient -t .../patient-web .
#
# The surface is a BUILD argument, not a runtime one. It has to be: the patient
# and admin surfaces run different Tailwind v4 design systems whose @theme
# blocks define the same token names with different values, and CSS cannot
# branch at runtime. scripts/select-surface.mjs picks the stylesheet before the
# bundler runs. Baking it in also lets the other surfaces' code be dropped as
# dead branches rather than shipped to every browser.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG TELEMED_SURFACE=patient
ENV TELEMED_SURFACE=${TELEMED_SURFACE}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ARG TELEMED_SURFACE=patient
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Also set at runtime: proxy.ts and the server components read it to decide
# which routes this deployment serves. It must match the surface it was built
# for -- a mismatch would serve one surface's stylesheet with another's routes.
ENV TELEMED_SURFACE=${TELEMED_SURFACE}
RUN addgroup -g 65532 -S nextjs && adduser -S nextjs -u 65532 -G nextjs
COPY --from=builder --chown=65532:65532 /app/public ./public
COPY --from=builder --chown=65532:65532 /app/.next/standalone ./
COPY --from=builder --chown=65532:65532 /app/.next/static ./.next/static
USER 65532:65532
EXPOSE 3000
CMD ["node", "server.js"]
