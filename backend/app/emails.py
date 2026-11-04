"""Transactional email via Resend (https://resend.com)."""
import html
import logging

import httpx

from .config import get_settings

log = logging.getLogger("zenty.email")
settings = get_settings()

BRAND = "#0f231d"
ACCENT = "#226d55"


def _layout(title: str, body_html: str) -> str:
    return f"""<!doctype html><html><body style="margin:0;background:#f6f3ec;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e2d5">
<tr><td style="background:{BRAND};padding:24px 32px;color:#cdec85;font-size:24px;font-weight:700;letter-spacing:.3px;font-family:Georgia,serif">Zenty</td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:22px;color:{BRAND}">{html.escape(title)}</h1>
{body_html}
</td></tr>
<tr><td style="padding:16px 32px;background:#f6f3ec;font-size:12px;color:#7a746b">
Zenty will never ask for your password or bank login by email. If you didn't expect this message, you can ignore it.
</td></tr></table></td></tr></table></body></html>"""


def _button(url: str, label: str) -> str:
    return (f'<p style="margin:28px 0"><a href="{html.escape(url, quote=True)}" '
            f'style="background:{ACCENT};color:#fff;text-decoration:none;padding:12px 22px;'
            f'border-radius:10px;font-weight:600;display:inline-block">{html.escape(label)}</a></p>')


def send_email(to: str, subject: str, html_body: str) -> bool:
    if not settings.resend_api_key:
        log.warning("RESEND_API_KEY not set; skipped email '%s'", subject)
        return False
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.email_from, "to": [to], "subject": subject, "html": html_body},
            timeout=10,
        )
        if r.status_code >= 300:
            log.error("Resend error %s for '%s'", r.status_code, subject)
            return False
        return True
    except httpx.HTTPError as exc:
        log.error("Email send failed: %s", type(exc).__name__)
        return False


def send_welcome(to: str, name: str, verify_url: str | None) -> bool:
    first = html.escape((name or "there").split(" ")[0])
    verify_block = (
        "<p>Please confirm your email so we can keep your account secure and unlock bank linking:</p>"
        + _button(verify_url, "Verify my email")
        if verify_url else ""
    )
    body = f"""
<p>Hi {first},</p>
<p>Welcome to Zenty, your calm, private home for budgets, savings goals, investments and bank accounts.</p>
{verify_block}
<p style="margin-top:24px"><strong>Here's how to get started:</strong></p>
<ul style="padding-left:20px;line-height:1.7">
<li>Set a monthly budget for your top spending categories</li>
<li>Create a savings goal and watch the progress bar fill up</li>
<li>Add your stocks to get a daily email when they move</li>
<li>Securely link your bank so transactions import automatically</li>
</ul>
{_button(settings.app_url, "Open Zenty")}
<p>Happy saving,<br>The Zenty team</p>"""
    return send_email(to, "Welcome to Zenty 🎉", _layout(f"Welcome aboard, {first}!", body))


def send_verification(to: str, verify_url: str) -> bool:
    body = "<p>Confirm your email address to finish securing your Zenty account.</p>" + _button(verify_url, "Verify my email")
    return send_email(to, "Verify your Zenty email", _layout("Confirm your email", body))


def send_password_reset(to: str, reset_url: str) -> bool:
    body = ("<p>Someone (hopefully you) asked to reset your Zenty password.</p>"
            + _button(reset_url, "Choose a new password")
            + '<p style="font-size:13px;color:#7a746b">This link expires in 1 hour and can only be used once. '
              "If you didn't request it, your account is still safe and no action is needed.</p>")
    return send_email(to, "Reset your Zenty password", _layout("Password reset", body))


def send_stock_digest(to: str, name: str, movers: list[dict], threshold: float) -> bool:
    """movers: [{symbol, name, price, change_pct, shares, value_change}]"""
    first = html.escape((name or "there").split(" ")[0])
    ups = [m for m in movers if m["change_pct"] >= 0]
    downs = [m for m in movers if m["change_pct"] < 0]
    total = sum(m["value_change"] for m in movers)

    def rows(items):
        out = []
        for m in items:
            color = "#15803d" if m["change_pct"] >= 0 else "#b91c1c"
            arrow = "▲" if m["change_pct"] >= 0 else "▼"
            out.append(
                f'<tr><td style="padding:8px 0;font-weight:600">{html.escape(m["symbol"])}</td>'
                f'<td style="padding:8px 0;color:#57534e">{html.escape(m.get("name") or "")}</td>'
                f'<td style="padding:8px 0;text-align:right">${m["price"]:,.2f}</td>'
                f'<td style="padding:8px 0;text-align:right;color:{color};font-weight:600">{arrow} {abs(m["change_pct"]):.2f}%</td></tr>'
            )
        return "".join(out)

    sections = ""
    if ups:
        sections += f'<h3 style="color:#15803d;margin:20px 0 4px">Going up 📈</h3><table width="100%">{rows(ups)}</table>'
    if downs:
        sections += f'<h3 style="color:#b91c1c;margin:20px 0 4px">Going down 📉</h3><table width="100%">{rows(downs)}</table>'

    direction = "up" if total >= 0 else "down"
    body = f"""
<p>Hi {first}, here's today's move on stocks in your Zenty portfolio that changed by {threshold:g}% or more.</p>
<p style="font-size:18px">Your holdings moved <strong style="color:{'#15803d' if total >= 0 else '#b91c1c'}">{direction} ${abs(total):,.2f}</strong> today.</p>
{sections}
{_button(settings.app_url, "View portfolio")}
<p style="font-size:12px;color:#7a746b">Prices may be delayed. This is information, not financial advice.
Turn these emails off any time in Zenty → Settings.</p>"""
    subject = f"Your stocks are {direction} today {'📈' if total >= 0 else '📉'}"
    return send_email(to, subject, _layout("Daily stock update", body))


def send_security_alert(to: str, name: str, title: str, detail: str, device: str) -> bool:
    """Tell the account owner about a sensitive change, in case it wasn't them."""
    first = html.escape((name or "there").split(" ")[0])
    body = f"""
<p>Hi {first},</p>
<p>{html.escape(detail)}</p>
<table style="margin:16px 0;font-size:14px;color:#45413b">
<tr><td style="padding:2px 12px 2px 0;color:#7a746b">Device</td><td>{html.escape(device)}</td></tr>
</table>
<p><strong>Was this you?</strong> If so, there's nothing to do.</p>
<p>If it wasn't you, reset your password right away and sign out of all devices in Settings → Security.</p>
{_button(settings.app_url + "/signin", "Review my account")}"""
    return send_email(to, f"Security alert: {title}", _layout(title, body))
