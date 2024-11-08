# This image is covering both build and run steps

#############
# BUILD STAGE
ARG WORK_DIR=/opt/app \
    DOCKER_IMG=node:22.11.0

FROM "$DOCKER_IMG" AS builder
WORKDIR $WORK_DIR

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build the TypeScript application
COPY ./src .
RUN npm run build

##################
# PRODUCTION STAGE
FROM "$DOCKER_IMG" AS production
WORKDIR /

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage and source files from repository
COPY --from=builder $WORK_DIR/dist ./dist

# Optional: specific user permissions if needed
# USER node

ARG BUILD_ONLY="False"
ENV BUILD_ONLY=${BUILD_ONLY}
EXPOSE 3000
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
