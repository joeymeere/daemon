FROM oven/bun:latest

WORKDIR /playground
COPY ./ .

# Install dependencies at root level first
RUN bun install

# Build daemon
WORKDIR /playground/packages/daemon
RUN bun run build:all

# Build mcp
WORKDIR /playground/packages/mcp
RUN bun run build:all

# Setup for running
WORKDIR /playground/chat

EXPOSE 3001 3002 5173

CMD ["bun", "run", "devmcp"]
