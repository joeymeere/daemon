# CHANGELOG

## 0.1.16 - Unreleased
    - Modified system prompt to try and get it to hallucinate less
    - Took out embeddings from message lifecycle
    - Took out functions from IDaemonMCPServer (they should be added as serverTools not exposed functions)

## 0.1.15 - 2025-01-15 2:54 PM

    - Added hook system to daemon that allows you to run internal tools and hook back to servers

### 0.1.14 - 2025-01-15 2:00 PM

    - Added tools to message lifecycle
    - Added generated prompt to message lifecycle
    - Fixed sign method returning b64 of b64 bug
    - Added channelId to approval & checkApproval

### 0.1.13 - 2025-01-14 8:22 PM

    - Build moved to rolldown with polyfills
    - Added sign method

### 0.1.12 - Initial Release
