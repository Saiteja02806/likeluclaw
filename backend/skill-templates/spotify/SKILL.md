---
name: spotify
description: Spotify music search and browse
metadata:
  openclaw:
    requires:
      tools: ["exec", "read"]
---

# Spotify

Tools at `~/.openclaw/workspace/spotify-tools/`.

## Commands
- **Search**: `node ~/.openclaw/workspace/spotify-tools/search.js "<query>" [type] [limit]` (type: track/artist/album/playlist)
- **Artist info**: `node ~/.openclaw/workspace/spotify-tools/get_artist.js "<artist_id>"`

## Rules
- Say "Searching Spotify..." BEFORE running tools
- Include Spotify links: `https://open.spotify.com/track/{id}`
- Playback control not supported — can only search, recommend, and share links
