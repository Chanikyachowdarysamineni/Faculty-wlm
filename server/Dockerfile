FROM node:20-alpine

WORKDIR /app

# Install only production dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy runtime source files.
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node seeds ./seeds

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/deva/health >/dev/null || exit 1

USER node

CMD ["node", "src/index.js"]
