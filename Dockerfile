FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm ci
ENV NODE_ENV=production
ENV PORT=3000
ENV BUSINESS_DATA_DIR=/var/data/workspace
EXPOSE 3000
CMD ["npm", "start"]
