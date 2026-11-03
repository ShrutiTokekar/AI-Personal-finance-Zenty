"""Stock quotes from Yahoo Finance's public chart endpoint via httpx
(replaces yfinance + pandas, saving ~150 MB). Results are cached briefly."""
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import httpx

SYMBOL_RE = re.compile(r"^[A-Z0-9][A-Z0-9.\-=^]{0,11}$")
VALID_PERIODS = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "ytd", "max"}
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ZentyFinance/2.0)"}
_cache: dict[str, tuple[float, object]] = {}
_TTL = 60


def clean_symbol(symbol: str) -> str | None:
    s = (symbol or "").strip().upper()
    return s if SYMBOL_RE.match(s) else None


def _cached(key: str):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]
    return None


def _chart(symbol: str, rng: str = "5d", interval: str = "1d") -> dict | None:
    key = f"chart:{symbol}:{rng}:{interval}"
    if (c := _cached(key)) is not None:
        return c
    try:
        r = httpx.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
            params={"range": rng, "interval": interval},
            headers=_HEADERS,
            timeout=8,
        )
        if r.status_code != 200:
            return None
        result = (r.json().get("chart") or {}).get("result")
        data = result[0] if result else None
    except (httpx.HTTPError, ValueError):
        return None
    _cache[key] = (time.time(), data)
    return data


def get_quote(symbol: str) -> dict | None:
    sym = clean_symbol(symbol)
    if not sym:
        return None
    data = _chart(sym)
    if not data:
        return None
    meta = data.get("meta", {})
    price = meta.get("regularMarketPrice")
    if price is None:
        return None
    closes = [c for c in ((data.get("indicators", {}).get("quote") or [{}])[0].get("close") or []) if c is not None]
    prev = meta.get("previousClose") or (closes[-2] if len(closes) >= 2 else None) or meta.get("chartPreviousClose") or price
    change = price - prev
    return {
        "symbol": sym,
        "name": meta.get("longName") or meta.get("shortName") or sym,
        "current_price": float(price),
        "previous_close": float(prev),
        "price_change": float(change),
        "price_change_percent": float(change / prev * 100) if prev else 0.0,
        "day_high": meta.get("regularMarketDayHigh"),
        "day_low": meta.get("regularMarketDayLow"),
        "volume": meta.get("regularMarketVolume"),
        "market_cap": None,
        "pe_ratio": None,
        "fifty_two_week_high": meta.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": meta.get("fiftyTwoWeekLow"),
        "currency": meta.get("currency", "USD"),
        "exchange": meta.get("fullExchangeName") or meta.get("exchangeName"),
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


def get_quotes(symbols: list[str]) -> dict[str, dict | None]:
    symbols = [s for s in (clean_symbol(x) for x in symbols[:50]) if s]
    with ThreadPoolExecutor(max_workers=8) as pool:
        return dict(zip(symbols, pool.map(get_quote, symbols)))


def get_history(symbol: str, period: str = "1mo") -> list[dict] | None:
    sym = clean_symbol(symbol)
    if not sym or period not in VALID_PERIODS:
        return None
    interval = "5m" if period == "1d" else "1d" if period in {"5d", "1mo", "3mo", "6mo", "ytd", "1y"} else "1wk"
    data = _chart(sym, period, interval)
    if not data:
        return None
    ts = data.get("timestamp") or []
    q = (data.get("indicators", {}).get("quote") or [{}])[0]
    out = []
    for i, t in enumerate(ts):
        close = (q.get("close") or [None])[i] if i < len(q.get("close") or []) else None
        if close is None:
            continue
        out.append({
            "date": datetime.fromtimestamp(t, timezone.utc).isoformat(),
            "open": float((q.get("open") or [close])[i] or close),
            "high": float((q.get("high") or [close])[i] or close),
            "low": float((q.get("low") or [close])[i] or close),
            "close": float(close),
            "volume": int((q.get("volume") or [0])[i] or 0),
        })
    return out


def search(query: str) -> list[dict]:
    q = (query or "").strip()[:40]
    if not q:
        return []
    try:
        r = httpx.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": q, "quotesCount": 8, "newsCount": 0},
            headers=_HEADERS,
            timeout=8,
        )
        quotes = r.json().get("quotes", []) if r.status_code == 200 else []
    except (httpx.HTTPError, ValueError):
        return []
    return [
        {"symbol": x.get("symbol"), "name": x.get("longname") or x.get("shortname"),
         "exchange": x.get("exchDisp") or x.get("exchange"), "type": x.get("quoteType")}
        for x in quotes if x.get("symbol")
    ]
