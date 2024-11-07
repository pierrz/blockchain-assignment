# This image is covering both build and run steps

# Build stage
ARG WORKDIR=/opt/app \
    DOCKER_IMG=node:22.11.0

FROM "${DOCKER_IMG}" AS builder
WORKDIR ${WORKDIR}

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build the TypeScript application
COPY ./src .
RUN npm run build

# Production stage
FROM "${DOCKER_IMG}" AS production
WORKDIR /

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage and source files from repository
COPY --from=builder ${WORKDIR}/dist ./dist

# Optional: if your app needs specific user permissions
# USER node

# Expose default port (customize as needed)
EXPOSE 3000

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
