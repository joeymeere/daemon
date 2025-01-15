FROM oven/bun:latest

WORKDIR /playground
COPY ./. .
RUN cd packages/daemon && bun install && bun build:all && bun link && cd ../mcp && bun install && bun build:all && bun link

WORKDIR /playground/chat
RUN bun install

EXPOSE 3000
EXPOSE 5173

CMD ["bun", "run", "devmcp"]