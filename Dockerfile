# Single production image shared by all Node microservices.
# Each service runs the same image with a different `command:` in compose.
FROM node:24-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the source.
COPY . .

ENV NODE_ENV=production

# Default command (overridden per-service in docker-compose).
CMD ["node", "backend/server.js"]
