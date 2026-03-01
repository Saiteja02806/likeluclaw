#!/bin/bash
# Short wrapper for composio-tool.js — eliminates hallucination of wrong script names
# Usage: integrations apps | tools <app> | call <TOOL> '<json>' | search "keyword"
exec node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js "$@"
