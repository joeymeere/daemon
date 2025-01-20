FROM oven/bun:latest

WORKDIR /playground

COPY ./ .

WORKDIR /playground/packages/daemon
RUN bun install && \
    bun run build:all && \
    bun link

WORKDIR /playground/packages/mcp
RUN bun install && \
    bun run build:all && \
    bun link

WORKDIR /playground/chat
RUN bun install

EXPOSE 3001 3002 5173

CMD ["bun", "run", "devmcp"]
