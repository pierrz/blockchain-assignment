# Build stage
FROM node:22.11.0 AS builder

WORKDIR /opt/app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and config files
COPY . .

# Build the TypeScript application
RUN npm run build

# Production stage
FROM node:22.11.0 AS production

WORKDIR /opt/app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /opt/app/dist ./dist

# Set NODE_ENV
ENV NODE_ENV=production

# Optional: if your app needs specific user permissions
# USER node

# Expose default port (customize as needed)
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
