#!/usr/bin/env python3
"""
Headless GEO CLI for PilotDeck. Reads JSON from stdin or --payload-file, writes JSON to stdout.

Actions: score, verify, keywords, schema, rag_ingest, rag_query, history_summary
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")


def read_payload(args: argparse.Namespace) -> dict[str, Any]:
    if args.payload_file:
        text = Path(args.payload_file).read_text(encoding="utf-8")
    else:
        text = sys.stdin.read()
    data = json.loads(text.strip() or "{}")
    if not isinstance(data, dict):
        raise ValueError("payload must be a JSON object")
    return data


def load_content(payload: dict[str, Any]) -> str:
    content = payload.get("content")
    if isinstance(content, str) and content.strip():
        return content
    path = payload.get("content_path")
    if isinstance(path, str) and path.strip():
        p = Path(path)
        if p.is_file():
            return p.read_text(encoding="utf-8", errors="replace")
    return ""


def quick_assessment(content: str, brand: str) -> dict[str, Any]:
    brand = brand or ""
    assessment = {
        "has_title": bool(re.search(r"^#+\s+|^标题|^##", content, re.MULTILINE)),
        "has_list": bool(re.search(r"[-*•]\s+|^\d+[\.\)]\s+", content, re.MULTILINE)),
        "has_faq": bool(re.search(r"FAQ|常见问题|Q[：:]|问[：:]", content, re.IGNORECASE)),
        "brand_count": len(re.findall(re.escape(brand), content, re.IGNORECASE)) if brand else 0,
        "word_count": len(content),
    }
    quick_score = 0
    if assessment["has_title"]:
        quick_score += 5
    if assessment["has_list"]:
        quick_score += 5
    if assessment["has_faq"]:
        quick_score += 5
    if brand and 2 <= assessment["brand_count"] <= 4:
        quick_score += 10
    elif brand and assessment["brand_count"] > 0:
        quick_score += 5
    assessment["quick_score"] = min(quick_score, 30)
    return assessment


def action_score(payload: dict[str, Any]) -> dict[str, Any]:
    brand = str(payload.get("brand") or "").strip()
    platform = str(payload.get("platform") or "通用").strip()
    content = load_content(payload)
    if not content:
        return {
            "ok": False,
            "error": "missing content or content_path",
            "degradation": "no_content",
        }
    qa = quick_assessment(content, brand)
    total = min(100, qa["quick_score"] * 3 + (10 if qa["word_count"] > 400 else 0))
    return {
        "ok": True,
        "data": {
            "scores": {
                "structure": min(25, qa["quick_score"]),
                "brand_mention": min(25, qa["brand_count"] * 5 if brand else 0),
                "authority": 10,
                "citations": min(25, 10 if qa["has_faq"] else 5),
                "total": total,
            },
            "details": {
                "structure": "规则快评：标题/列表/FAQ 结构",
                "brand_mention": f"品牌出现 {qa['brand_count']} 次",
                "authority": "未调用 LLM 深度评分",
                "citations": "可引用性启发式评估",
            },
            "improvements": [
                "结合 CORE-EEAT 清单做人工/Agent 深度评分",
                "确保 FAQ 与对比表便于 AI 抽取",
            ],
            "strengths": ["已生成可评分正文"],
            "platform": platform,
        },
        "scoring_mode": "quick",
    }


BOCHA_WEB_SEARCH_ENDPOINT = "https://api.bochaai.com/v1/web-search"


def action_verify(payload: dict[str, Any]) -> dict[str, Any]:
    brand = str(payload.get("brand") or "").strip()
    queries = payload.get("queries") or []
    if not isinstance(queries, list):
        queries = [str(queries)]
    queries = [str(q).strip() for q in queries if str(q).strip()][:10]
    bocha_key = (
        str(payload.get("bocha_api_key") or "").strip()
        or os.environ.get("BOCHA_API_KEY", "").strip()
    )
    if bocha_key and queries:
        try:
            results = []
            for query in queries:
                results.append(_verify_bocha(query, brand, bocha_key))
            report = _verification_report(results)
            return {
                "ok": True,
                "data": {
                    "results": results,
                    "report": report,
                    "is_mock": False,
                    "verification_mode": "bocha_web_search",
                },
            }
        except Exception as exc:  # noqa: BLE001
            data = _agent_led_verify(brand, queries)
            return {
                "ok": True,
                "data": data,
                "degradation": "bocha_failed",
                "error": str(exc),
            }
    return {
        "ok": True,
        "data": _agent_led_verify(brand, queries),
        "verification_mode": "agent_web_search",
    }


def _parse_bocha_snippets(raw: dict[str, Any], limit: int = 8) -> list[str]:
    data = raw.get("data")
    if not isinstance(data, dict):
        return []
    web_pages = data.get("webPages")
    if not isinstance(web_pages, dict):
        return []
    items = web_pages.get("value")
    if not isinstance(items, list):
        return []
    snippets: list[str] = []
    for entry in items[:limit]:
        if not isinstance(entry, dict):
            continue
        for key in ("summary", "snippet", "content", "name"):
            value = entry.get(key)
            if isinstance(value, str) and value.strip():
                snippets.append(value.strip())
                break
    return snippets


def _verify_bocha(query: str, brand: str, api_key: str) -> dict[str, Any]:
    import httpx  # noqa: PLC0415

    body = {
        "query": query,
        "summary": True,
        "freshness": "noLimit",
        "count": 8,
    }
    resp = httpx.post(
        BOCHA_WEB_SEARCH_ENDPOINT,
        json=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=45.0,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Bocha HTTP {resp.status_code}")
    raw = resp.json()
    if isinstance(raw, dict):
        code = raw.get("code")
        if isinstance(code, int) and code != 200:
            msg = raw.get("msg") if isinstance(raw.get("msg"), str) else "search provider error"
            raise RuntimeError(f"Bocha error code={code}: {msg}")
    snippets = _parse_bocha_snippets(raw if isinstance(raw, dict) else {})
    response_text = "\n".join(snippets)[:2000] if snippets else "（博查未返回可用摘要）"
    mention = _analyze_mention(response_text, brand)
    return {
        "success": True,
        "query": query,
        "brand": brand,
        "response": response_text,
        "mentioned": mention["count"] > 0,
        "mention_count": mention["count"],
        "sentiment": mention["sentiment"],
        "is_mock": False,
        "source": "bocha",
    }


def _agent_led_verify(brand: str, queries: list[str]) -> dict[str, Any]:
    return {
        "brand": brand,
        "queries": queries,
        "verification_mode": "agent_web_search",
        "instructions": (
            "对每条验证问句：① 优先调用内置 web_search（模型联网检索）并归纳摘要；"
            "② 若 web_search 软失败或无有效结果，系统会自动尝试博查（BOCHA_API_KEY）；"
            "③ 根据检索摘要判断品牌是否被提及，写入 verify-report.json 与 report.md。"
            "勿使用 Perplexity / Google 等额外搜索 API。"
        ),
        "results": [],
        "report": {
            "total_queries": len(queries),
            "mentioned_count": 0,
            "mention_rate": 0.0,
            "not_mentioned_queries": queries[:5],
            "pending_agent_completion": True,
        },
        "is_mock": False,
    }


def _analyze_mention(text: str, brand: str) -> dict[str, Any]:
    if not brand:
        return {"count": 0, "sentiment": "neutral"}
    count = text.lower().count(brand.lower())
    sentiment = "neutral"
    if count > 0:
        positive = ["推荐", "领先", "优秀", "best", "leading", "recommend"]
        negative = ["问题", "不足", "avoid", "poor", "issue"]
        ctx = text.lower()
        pos = sum(1 for w in positive if w in ctx)
        neg = sum(1 for w in negative if w in ctx)
        if pos > neg:
            sentiment = "positive"
        elif neg > pos:
            sentiment = "negative"
    return {"count": count, "sentiment": sentiment}


def _verification_report(results: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(results)
    mentioned = sum(1 for r in results if r.get("mentioned"))
    rate = mentioned / total if total else 0.0
    return {
        "total_queries": total,
        "mentioned_count": mentioned,
        "mention_rate": rate,
        "not_mentioned_queries": [r["query"] for r in results if not r.get("mentioned")][:5],
    }


def action_keywords(payload: dict[str, Any]) -> dict[str, Any]:
    brand = str(payload.get("brand") or "品牌").strip()
    advantages = str(payload.get("advantages") or "核心优势").strip()
    competitors = payload.get("competitors") or []
    if isinstance(competitors, str):
        competitors = [c.strip() for c in competitors.split("\n") if c.strip()]
    intents = ["是什么", "哪个好", "怎么选", "推荐", "对比", "价格", "靠谱吗"]
    keywords = []
    for intent in intents:
        keywords.append({"keyword": f"{brand} {intent}", "intent": intent})
    for comp in competitors[:3]:
        keywords.append({"keyword": f"{brand} 和 {comp} 哪个好", "intent": "对比"})
    verify_queries = [k["keyword"] for k in keywords[:10]]
    return {
        "ok": True,
        "data": {
            "brand": brand,
            "advantages": advantages,
            "keywords": keywords,
            "verify_queries": verify_queries,
        },
    }


def action_schema(payload: dict[str, Any]) -> dict[str, Any]:
    brand = str(payload.get("brand") or "Brand").strip()
    page_type = str(payload.get("page_type") or "faq").strip().lower()
    content = load_content(payload)
    faqs = []
    for line in content.splitlines():
        if line.strip().endswith("？") or line.strip().endswith("?"):
            faqs.append({"question": line.strip("# ").strip(), "answer": "见正文说明。"})
        if len(faqs) >= 5:
            break
    if not faqs:
        faqs = [
            {"question": f"{brand} 适合谁？", "answer": "见官网与产品说明。"},
            {"question": f"如何评价 {brand}？", "answer": "见对比与案例章节。"},
        ]
    if page_type == "article":
        schema = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": brand,
            "author": {"@type": "Organization", "name": brand},
        }
    else:
        schema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": item["question"],
                    "acceptedAnswer": {"@type": "Answer", "text": item["answer"]},
                }
                for item in faqs
            ],
        }
    return {"ok": True, "data": {"schema": schema, "page_type": page_type}}


def _data_dir(payload: dict[str, Any]) -> Path:
    raw = str(payload.get("data_dir") or os.environ.get("PILOTDECK_GEO_DATA_DIR") or "").strip()
    if raw:
        return Path(raw).expanduser()
    home = Path.home() / ".pilotdeck" / "geo-data"
    return home


def action_rag_ingest(payload: dict[str, Any]) -> dict[str, Any]:
    data_dir = _data_dir(payload)
    kb_dir = data_dir / "kb"
    kb_dir.mkdir(parents=True, exist_ok=True)
    source = payload.get("source_path")
    if isinstance(source, str) and Path(source).is_file():
        dest = kb_dir / Path(source).name
        dest.write_text(Path(source).read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
        return {"ok": True, "data": {"ingested": str(dest)}}
    text = str(payload.get("text") or "").strip()
    if text:
        name = str(payload.get("name") or "snippet.txt")
        (kb_dir / name).write_text(text, encoding="utf-8")
        return {"ok": True, "data": {"ingested": str(kb_dir / name)}}
    return {"ok": False, "error": "source_path or text required"}


def action_rag_query(payload: dict[str, Any]) -> dict[str, Any]:
    data_dir = _data_dir(payload)
    kb_dir = data_dir / "kb"
    query = str(payload.get("query") or "").strip().lower()
    hits = []
    if kb_dir.is_dir():
        for path in kb_dir.glob("*"):
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            if not query or query in text.lower():
                hits.append({"file": path.name, "excerpt": text[:500]})
    return {"ok": True, "data": {"hits": hits[:5]}}


def action_history_summary(payload: dict[str, Any]) -> dict[str, Any]:
    data_dir = _data_dir(payload)
    db = data_dir / "geo_data.db"
    return {
        "ok": True,
        "data": {
            "sqlite_path": str(db),
            "exists": db.is_file(),
            "summary": "历史 ROI 数据库未启用或为空（首期只读占位）。",
        },
    }


HANDLERS = {
    "score": action_score,
    "verify": action_verify,
    "keywords": action_keywords,
    "schema": action_schema,
    "rag_ingest": action_rag_ingest,
    "rag_query": action_rag_query,
    "history_summary": action_history_summary,
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload-file")
    args = parser.parse_args()
    try:
        payload = read_payload(args)
        action = str(payload.get("action") or "").strip().lower()
        if action not in HANDLERS:
            emit({"ok": False, "error": f"unknown action: {action}"})
            return 1
        result = HANDLERS[action](payload)
        emit(result)
        return 0 if result.get("ok") else 1
    except Exception as exc:  # noqa: BLE001
        emit({"ok": False, "error": str(exc), "degradation": "cli_exception"})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
