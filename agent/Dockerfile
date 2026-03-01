FROM node:22-alpine

# Install dependencies
RUN apk add --no-cache bash curl

WORKDIR /home/node

# Install OpenClaw globally from npm (stable release)
RUN npm install -g openclaw@latest

# Create .openclaw config directory
RUN mkdir -p /home/node/.openclaw && chown -R node:node /home/node

USER node

# Expose Gateway port
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:18789/health || exit 1

# Start OpenClaw Gateway in foreground mode
CMD ["openclaw", "gateway", "start", "--foreground", "--port", "18789"]
