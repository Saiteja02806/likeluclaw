---
name: twitter
description: X/Twitter search and post
metadata:
  openclaw:
    requires:
      tools: ["exec", "read"]
---

# Twitter / X

Tools at `~/.openclaw/workspace/twitter-tools/`.

## Commands
- **Search tweets**: `node ~/.openclaw/workspace/twitter-tools/search_tweets.js "<query>" [count]`
- **User profile**: `node ~/.openclaw/workspace/twitter-tools/get_user.js "<username>"`

## Rules
- Say "Searching Twitter..." BEFORE running tools
- NEVER auto-post — show draft and wait for confirmation
- Include tweet links: `https://x.com/{username}/status/{id}`
