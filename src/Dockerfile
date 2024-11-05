# Build stage
ARG WORKDIR=/opt/app \
    DOCKER_IMG=node:22.11.0

FROM "${DOCKER_IMG}" AS builder

WORKDIR ${WORKDIR}

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and config files
COPY . .

# Build the TypeScript application
RUN npm run build

# Production stage
FROM "${DOCKER_IMG}" AS production

WORKDIR /dist

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder ${WORKDIR}/dist .
# COPY --from=builder ${WORKDIR}/config ./config

# Set NODE_ENV
ENV NODE_ENV=production

# Optional: if your app needs specific user permissions
# USER node

# Expose default port (customize as needed)
EXPOSE 3000

# Start the application from /dist
CMD ["node", "index.js"]
