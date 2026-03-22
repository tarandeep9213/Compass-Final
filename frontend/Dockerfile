# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install deps (cached layer)
COPY package.json package-lock.json ./
RUN npm ci

# VITE_API_URL is injected at build time so the bundle knows where the API lives.
# Override via docker-compose build args or --build-arg.
ARG VITE_API_URL=http://localhost:8000/v1
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build


# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our SPA-aware nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
