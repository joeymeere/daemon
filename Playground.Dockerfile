FROM oven/bun:latest

WORKDIR /app

COPY ./client .
RUN bun install

EXPOSE 4173
EXPOSE 3000

CMD ["bun", "run", "playground"]