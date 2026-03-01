FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/
COPY skill-templates/ ./skill-templates/
COPY soul-presets/ ./soul-presets/

EXPOSE 3000

CMD ["node", "src/server.js"]
