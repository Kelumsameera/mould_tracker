FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm ci --omit=dev --registry=$NPM_REGISTRY
COPY . .
ENV NODE_ENV=production
# Item and work-log pictures (a volume in production); the app runs as "node", so it must own the folder.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 4000
CMD ["node", "index.js"]
