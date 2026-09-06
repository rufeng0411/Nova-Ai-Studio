#!/usr/bin/env python3
"""Run MinerU cloud/local parse and emit JSON to stdout for document-import."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))

from mineru_cloud import run_mineru  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="MinerU import JSON emitter")
    parser.add_argument("--input", required=True)
    parser.add_argument("--api-url", default=os.environ.get("PILOTDECK_DOCUMENT_OCR_API_URL", "https://mineru.net/api/v4"))
    parser.add_argument("--mode", default=os.environ.get("PILOTDECK_DOCUMENT_OCR_MODE", "cloud"))
    args = parser.parse_args()
    token = os.environ.get("MINERU_API_TOKEN", "").strip()
    if args.mode == "cloud" and not token:
        print("Error: MINERU_API_TOKEN required for cloud mode", file=sys.stderr)
        return 1
    payload = run_mineru(args.input, token, args.api_url.rstrip("/"), args.mode)
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
