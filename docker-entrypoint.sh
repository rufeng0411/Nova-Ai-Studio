#!/usr/bin/env bash
set -euo pipefail

PILOT_HOME="${PILOT_HOME:-/root/.pilotdeck}"
CONFIG_FILE="$PILOT_HOME/pilotdeck.yaml"

DATA_ROOT="${DATA_ROOT:-/data/saas}"
mkdir -p \
  "$DATA_ROOT" \
  "$PILOT_HOME/projects" \
  "$PILOT_HOME/router" \
  "$PILOT_HOME/skills" \
  "$PILOT_HOME/plugins" \
  "$PILOT_HOME/memory"

# Sync bundled skills into PILOT_HOME (skip existing; refresh list in bootstrap script)
if [ "${PILOTDECK_SKIP_BOOTSTRAP:-}" != "1" ]; then
  node scripts/bootstrap-pilotdeck-config.mjs || true
fi

if [ -d "$CONFIG_FILE" ]; then
  echo "[pilotdeck-docker] ERROR: $CONFIG_FILE is a directory, not a config file." >&2
  echo "[pilotdeck-docker] If you intended to mount a YAML config, create the host file first or remove the bind mount and use PILOTDECK_* env vars." >&2
  exit 1
fi

# ── Generate config from env vars if no config file is mounted ────────
if [ ! -f "$CONFIG_FILE" ]; then
  MODEL="${PILOTDECK_MODEL:-openrouter/deepseek/deepseek-v4-flash}"
  LIGHT_MODEL="${PILOTDECK_LIGHT_MODEL:-openrouter/qwen/qwen3-8b}"
  API_KEY="${PILOTDECK_API_KEY:-PLACEHOLDER_RUN_ONBOARDING_TO_REPLACE}"
  API_URL="${PILOTDECK_API_URL:-https://openrouter.ai/api/v1}"

  # Derive provider name from model string (e.g. "openrouter/deepseek/deepseek-v4-flash" -> "openrouter")
  PROVIDER="${MODEL%%/*}"
  LIGHT_PROVIDER="${LIGHT_MODEL%%/*}"
  # Model ID is everything after the first slash
  MODEL_ID="${MODEL#*/}"
  LIGHT_MODEL_ID="${LIGHT_MODEL#*/}"

  # Router section shared by both same-provider and cross-provider branches
  ROUTER_SECTION="router:
  scenarios:
    default: ${MODEL}
  fallback:
    default:
      - ${MODEL}
  zeroUsageRetry:
    enabled: true
    maxAttempts: 2
  tokenSaver:
    enabled: true
    judge: ${LIGHT_MODEL}
    defaultTier: medium
    judgeTimeoutMs: 15000
    tiers:
      simple:
        model: ${LIGHT_MODEL}
        description: \"Simple greetings, confirmations, single-step Q&A, trivial file writes, remembering rules\"
      medium:
        model: ${LIGHT_MODEL}
        description: \"Single tool call, short text generation, 1-2 file read/write, code generation\"
      complex:
        model: ${MODEL}
        description: \"Needs sub-agent orchestration: parallel workstreams, delegation to specialized agents\"
      reasoning:
        model: ${MODEL}
        description: \"Deep single-agent work: multi-file operations, data analysis, multi-step workflows, web research, structured reports from many sources\"
    rules:
      - \"complex is ONLY for tasks that need sub-agent orchestration or parallel delegation — do NOT use it for single-agent multi-step work\"
      - \"Multi-file operations, data analysis, and multi-step workflows without orchestration should be reasoning\"
      - \"Simple file creation (1-2 files) or single code generation is medium\"
      - \"Trivial greetings, confirmations, remembering rules, or reading one file and answering a short question is simple\"
  autoOrchestrate:
    enabled: true
    triggerTiers:
      - complex
    slimSystemPrompt: true
    allowedTools:
      - agent
      - read_file
      - grep
      - glob
      - read_skill
    subagentMaxTokens: 128000
  stats:
    enabled: true"

  if [ "$PROVIDER" = "$LIGHT_PROVIDER" ]; then
    # Same provider for both models
    cat > "$CONFIG_FILE" <<YAML
schemaVersion: 1
agent:
  model: ${MODEL}
model:
  providers:
    ${PROVIDER}:
      protocol: openai
      url: ${API_URL}
      apiKey: ${API_KEY}
      models:
        ${MODEL_ID}:
          capabilities:
            maxOutputTokens: 32768
        ${LIGHT_MODEL_ID}:
          capabilities:
            maxOutputTokens: 16384
cron:
  enabled: true
${ROUTER_SECTION}
YAML
  else
    # Different providers — declare both
    LIGHT_API_URL="${PILOTDECK_LIGHT_API_URL:-${API_URL}}"
    LIGHT_API_KEY="${PILOTDECK_LIGHT_API_KEY:-${API_KEY}}"
    cat > "$CONFIG_FILE" <<YAML
schemaVersion: 1
agent:
  model: ${MODEL}
model:
  providers:
    ${PROVIDER}:
      protocol: openai
      url: ${API_URL}
      apiKey: ${API_KEY}
      models:
        ${MODEL_ID}:
          capabilities:
            maxOutputTokens: 32768
    ${LIGHT_PROVIDER}:
      protocol: openai
      url: ${LIGHT_API_URL}
      apiKey: ${LIGHT_API_KEY}
      models:
        ${LIGHT_MODEL_ID}:
          capabilities:
            maxOutputTokens: 16384
cron:
  enabled: true
${ROUTER_SECTION}
YAML
  fi

  echo "[pilotdeck-docker] Generated config at $CONFIG_FILE (provider=$PROVIDER, model=$MODEL, light=$LIGHT_MODEL)"
fi

# ── Forward proxy env vars ────────────────────────────────────────────
if [ -n "${PILOTDECK_PROXY:-}" ]; then
  export http_proxy="$PILOTDECK_PROXY"
  export https_proxy="$PILOTDECK_PROXY"
  export HTTP_PROXY="$PILOTDECK_PROXY"
  export HTTPS_PROXY="$PILOTDECK_PROXY"
  echo "[pilotdeck-docker] Proxy set to $PILOTDECK_PROXY"
fi

echo "[pilotdeck-docker] Starting PilotDeck (gateway + UI server)..."
echo "[pilotdeck-docker] Config: $CONFIG_FILE"
echo "[pilotdeck-docker] UI will be available at http://0.0.0.0:${SERVER_PORT:-3001}"

# PD-SAAS-FORK: warn when document export runtime is incomplete (PDF/PPT buttons fail silently otherwise)
if ! python3 -c "import pptx" 2>/dev/null; then
  echo "[pilotdeck-docker] WARNING: python-pptx missing — PPT export will fail until image is rebuilt." >&2
fi
if ! npx --yes playwright --version >/dev/null 2>&1; then
  echo "[pilotdeck-docker] WARNING: playwright CLI missing — PDF export may fail." >&2
fi

# ── Remove stale auth token so the bridge never uses a leftover value ──
rm -f "$PILOT_HOME/server-token"

# ── Start gateway + UI server via concurrently ────────────────────────
# The bridge retries for PILOTDECK_BRIDGE_TIMEOUT ms (default 30s) which
# may be too short on cold Docker starts. We first wait for the gateway
# health endpoint before launching the bridge, eliminating the race.
cd /app

GATEWAY_PORT="${PILOTDECK_GATEWAY_PORT:-18789}"
GATEWAY_HEALTH_URL="http://127.0.0.1:${GATEWAY_PORT}/health"
GATEWAY_READY_TIMEOUT="${PILOTDECK_GATEWAY_READY_TIMEOUT:-120}"

wait_for_gateway() {
  echo "[pilotdeck-docker] Waiting for gateway to become ready (timeout=${GATEWAY_READY_TIMEOUT}s)..."
  local elapsed=0
  while [ "$elapsed" -lt "$GATEWAY_READY_TIMEOUT" ]; do
    if curl -sf "$GATEWAY_HEALTH_URL" > /dev/null 2>&1; then
      echo "[pilotdeck-docker] Gateway is ready (took ${elapsed}s)."
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "[pilotdeck-docker] WARNING: Gateway did not become ready within ${GATEWAY_READY_TIMEOUT}s, starting bridge anyway." >&2
  return 0
}

node dist/src/cli/pilotdeck.js server &
GATEWAY_PID=$!

wait_for_gateway

# tsx 在镜像内全局安装；node --import tsx 在 /app 下找不到包会崩溃
tsx ui/server/index.js &
BRIDGE_PID=$!

# PD-SAAS-FORK: bridge warmup — 容器启动后预请求 captcha，缩短冷首访
warmup_bridge() {
  local port="${SERVER_PORT:-3001}"
  local warmup_url="http://127.0.0.1:${port}/api/saas/captcha"
  echo "[pilotdeck-docker] Warming up UI bridge (${warmup_url})..."
  local elapsed=0
  while [ "$elapsed" -lt 45 ]; do
    if curl -sf "$warmup_url" > /dev/null 2>&1; then
      echo "[pilotdeck-docker] Bridge warmup complete (took ${elapsed}s)."
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "[pilotdeck-docker] WARNING: Bridge warmup timed out after 45s." >&2
  return 0
}

warmup_bridge

# If either process exits, kill the other and propagate the exit code.
wait -n $GATEWAY_PID $BRIDGE_PID 2>/dev/null
EXIT_CODE=$?
kill $GATEWAY_PID $BRIDGE_PID 2>/dev/null
wait $GATEWAY_PID $BRIDGE_PID 2>/dev/null
exit $EXIT_CODE
