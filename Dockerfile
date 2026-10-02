# Imagine de productie pentru Villa Les Mouettes (Next.js). Se ruleaza cu variabilele din README.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3100
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
ENV VLM_DATA_DIR=/app/.data
RUN mkdir -p /app/.data && chown -R node:node /app/.data
VOLUME /app/.data
USER node
EXPOSE 3100
CMD ["npm", "start"]
