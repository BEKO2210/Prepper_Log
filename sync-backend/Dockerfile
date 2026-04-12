FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=8787
ENV DB_PATH=/data/sync.db

EXPOSE 8787
VOLUME ["/data"]

CMD ["npm", "start"]
