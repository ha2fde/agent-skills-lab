FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=8787 WECHAT_DATA_DIR=/app/data
EXPOSE 8787
CMD ["node", "src/server.mjs", "--http"]
