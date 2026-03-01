FROM node:22-alpine

# Install git and other dependencies
RUN apk add --no-cache git bash curl

WORKDIR /home/node

# Clone OpenClaw from official repo
RUN git clone https://github.com/openclaw/openclaw.git && \
    cd openclaw && \
    npm install -g pnpm && \
    pnpm install && \
    pnpm ui:build && \
    pnpm build

# Install OpenClaw globally from the built source
RUN cd openclaw && npm install -g .

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
