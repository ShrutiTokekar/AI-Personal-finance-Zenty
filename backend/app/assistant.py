"""Zenty Assistant: a small rule-based helper (no AI models, no external calls).

Understands short commands like:
  "spent $25 on food"        "got paid 2000 salary"
  "how much did I spend"     "spending on groceries"
  "show my budgets"          "set budget food 400"
  "show savings goals"       "save 50 to vacation"
  "how are my stocks"        "predict next month"     "give me advice"
"""
import re

from sqlalchemy.orm import Session

from . import insights
from .models import Budget, SavingsGoal, SavingsTransaction, StockHolding, Transaction, utcnow

AMOUNT = r"\$?\s*(\d{1,9}(?:,\d{3})*(?:\.\d{1,2})?)"

CATEGORY_WORDS = {
    "Food & Dining": ["food", "lunch", "dinner", "breakfast", "restaurant", "coffee", "cafe", "pizza", "takeout", "dining"],
    "Groceries": ["grocery", "groceries", "supermarket", "walmart", "costco", "aldi"],
    "Transportation": ["uber", "lyft", "taxi", "gas", "fuel", "bus", "train", "metro", "parking", "transport"],
    "Shopping": ["shopping", "amazon", "clothes", "shoes", "mall"],
    "Entertainment": ["movie", "netflix", "spotify", "game", "concert", "entertainment"],
    "Bills & Utilities": ["rent", "electric", "water", "internet", "phone", "bill", "utilities"],
    "Health": ["doctor", "pharmacy", "medicine", "gym", "health"],
    "Travel": ["flight", "hotel", "airbnb", "travel", "trip"],
    "Education": ["book", "course", "tuition", "school", "education"],
}
INCOME_WORDS = {"Salary": ["salary", "paycheck", "paid", "wage"], "Freelance": ["freelance", "client", "gig"],
                "Investment": ["dividend", "interest"], "Gift": ["gift"]}

HELP = (
    "Here's what I can help with:\n"
    "• \"spent $25 on lunch\" to log an expense\n"
    "• \"got paid 2000 salary\" to log income\n"
    "• \"how much did I spend this month?\"\n"
    "• \"show my budgets\" or \"set budget groceries 400\"\n"
    "• \"show savings goals\" or \"save 50 to vacation\"\n"
    "• \"how are my stocks?\"\n"
    "• \"predict next month\" or \"give me advice\""
)


def _amount(text: str) -> float | None:
    m = re.search(AMOUNT, text)
    return float(m.group(1).replace(",", "")) if m else None


def _guess(text: str, table: dict[str, list[str]], default: str) -> str:
    low = text.lower()
    for cat, words in table.items():
        if any(re.search(rf"\b{w}\b", low) for w in words):
            return cat
    m = re.search(r"\b(?:on|for)\s+([a-z][a-z &]{1,30})", low)
    return m.group(1).strip().title() if m else default


def _money(x: float) -> str:
    return f"${x:,.2f}"


def _bar(pct: float) -> str:
    filled = max(0, min(10, round(pct / 10)))
    return "█" * filled + "░" * (10 - filled)


def respond(db: Session, user_id: int, message: str) -> dict:
    text = (message or "").strip()[:500]
    low = text.lower()
    if not text:
        return {"type": "text", "message": HELP}

    def reply(msg: str) -> dict:
        # The chat window shows plain text, so drop markdown bold markers.
        return {"type": "text", "message": msg.replace("**", "")}

    # --- savings contributions: "save 50 to vacation" / "add 100 to emergency fund"
    m = re.search(rf"(?:save|add|put|contribute)\s+{AMOUNT}\s+(?:to|into|towards?)\s+(?:my\s+)?(.+)", low)
    if m and ("goal" in low or "sav" in low or db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id).count()):
        amt = float(m.group(1).replace(",", ""))
        name = m.group(2).replace("goal", "").replace("savings", "").strip(" .!")
        goal = db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id, SavingsGoal.name.ilike(f"%{name}%")).first()
        if goal:
            goal.current_amount += amt
            goal.completed = goal.current_amount >= goal.target_amount
            db.add(SavingsTransaction(goal_id=goal.id, amount=amt, description="Added via assistant"))
            db.commit()
            p = goal.current_amount / goal.target_amount * 100 if goal.target_amount else 0
            extra = " 🎉 Goal reached!" if goal.completed else ""
            return reply(f"Added {_money(amt)} to **{goal.name}**.\n{_bar(p)} {p:.0f}% ({_money(goal.current_amount)} of {_money(goal.target_amount)}){extra}")

    # --- create savings goal: "create goal vacation 2000"
    m = re.search(rf"(?:create|new|start)\s+(?:a\s+)?(?:savings\s+)?goal\s+(?:for\s+|called\s+)?([a-z][a-z0-9 ]{{1,40}}?)\s+(?:of\s+|for\s+)?{AMOUNT}", low)
    if m:
        name, amt = m.group(1).strip().title(), float(m.group(2).replace(",", ""))
        db.add(SavingsGoal(user_id=user_id, name=name, target_amount=amt))
        db.commit()
        return reply(f"Created savings goal **{name}** with a target of {_money(amt)}. Say \"save 50 to {name.lower()}\" to add money.")

    # --- set budget: "set budget food 400" / "budget 300 for groceries"
    if "budget" in low and re.search(r"\b(set|create|make|change|update)\b|budget\s+(?:of\s+)?\$?\d|\d+\s+for", low):
        amt = _amount(low)
        if amt:
            cat = _guess(re.sub(AMOUNT, "", low), CATEGORY_WORDS, "")
            if not cat:
                m2 = re.search(r"budget\s+(?:for\s+)?([a-z][a-z &]+)", re.sub(AMOUNT, "", low))
                cat = m2.group(1).replace("set", "").strip().title() if m2 else ""
            if cat:
                b = db.query(Budget).filter(Budget.user_id == user_id, Budget.category == cat).first()
                if b:
                    b.monthly_limit = amt
                else:
                    db.add(Budget(user_id=user_id, category=cat, monthly_limit=amt))
                db.commit()
                return reply(f"Budget for **{cat}** set to {_money(amt)} per month.")
        return reply("Tell me the category and amount, e.g. \"set budget groceries 400\".")

    # --- log income
    if re.search(r"\b(earned|got paid|received|income|salary|paycheck|got \$?\d)", low) and _amount(low):
        amt = _amount(low)
        cat = _guess(low, INCOME_WORDS, "Other Income")
        db.add(Transaction(user_id=user_id, amount=amt, category=cat, type="income", description=text[:200], date=utcnow()))
        db.commit()
        return reply(f"💰 Logged {_money(amt)} income under **{cat}**.")

    # --- log expense
    if re.search(r"\b(spent|spend|paid|bought|cost|purchase[d]?)\b", low) and _amount(low) and not re.search(r"how much|what did", low):
        amt = _amount(low)
        cat = _guess(low, CATEGORY_WORDS, "Other")
        db.add(Transaction(user_id=user_id, amount=amt, category=cat, type="expense", description=text[:200], date=utcnow()))
        db.commit()
        msg = f"✅ Logged {_money(amt)} expense under **{cat}**."
        for b in insights.budgets_with_spend(db, user_id):
            if b["category"] == cat:
                if b["remaining"] < 0:
                    msg += f"\n⚠️ You're {_money(-b['remaining'])} over your {cat} budget."
                else:
                    msg += f"\n{_money(b['remaining'])} left in your {cat} budget this month."
        return reply(msg)

    # --- budgets
    if "budget" in low:
        budgets = insights.budgets_with_spend(db, user_id)
        if not budgets:
            return reply("You don't have any budgets yet. Try \"set budget groceries 400\".")
        lines = []
        for b in budgets:
            p = b["current_spent"] / b["monthly_limit"] * 100 if b["monthly_limit"] else 0
            flag = " ⚠️" if p > 100 else ""
            lines.append(f"**{b['category']}**: {_money(b['current_spent'])} / {_money(b['monthly_limit'])}\n{_bar(p)} {p:.0f}%{flag}")
        return reply("Your budgets this month:\n\n" + "\n\n".join(lines))

    # --- savings goals
    if "goal" in low or "saving" in low:
        goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id).order_by(SavingsGoal.created_at.desc()).all()
        if not goals:
            return reply("No savings goals yet. Try \"create goal vacation 2000\".")
        lines = []
        for g in goals:
            p = g.current_amount / g.target_amount * 100 if g.target_amount else 0
            lines.append(f"**{g.name}**{' ✅' if g.completed else ''}: {_money(g.current_amount)} / {_money(g.target_amount)}\n{_bar(p)} {p:.0f}%")
        return reply("Your savings goals:\n\n" + "\n\n".join(lines))

    # --- stocks
    if re.search(r"\b(stock|stocks|portfolio|shares|invest)", low):
        holdings = db.query(StockHolding).filter(StockHolding.user_id == user_id).all()
        if not holdings:
            return reply("You haven't added any stocks yet. Head to the Stocks tab to add some.")
        from .stocks import get_quotes
        quotes = get_quotes(sorted({h.symbol for h in holdings}))
        cost = value = 0.0
        lines = []
        for h in holdings:
            q = quotes.get(h.symbol)
            price = q["current_price"] if q else h.purchase_price
            cost += h.shares * h.purchase_price
            value += h.shares * price
            day = f" ({q['price_change_percent']:+.2f}% today)" if q else ""
            lines.append(f"**{h.symbol}**: {h.shares:g} × {_money(price)}{day}")
        gain = value - cost
        pct = gain / cost * 100 if cost else 0
        return reply(f"Portfolio value {_money(value)}, {'up' if gain >= 0 else 'down'} {_money(abs(gain))} ({pct:+.1f}%) overall.\n\n" + "\n".join(lines))

    # --- prediction
    if re.search(r"predict|forecast|next month", low):
        p = insights.predict_next_month(db, user_id)
        if not p["predictions"]:
            return reply(p.get("error", "Not enough data yet."))
        total = sum(p["predictions"].values())
        lines = [f"• {c}: {_money(v)}" for c, v in sorted(p["predictions"].items(), key=lambda kv: -kv[1])]
        return reply(f"Based on recent months, I expect about **{_money(total)}** in spending next month:\n" + "\n".join(lines))

    # --- advice
    if re.search(r"advice|tip|how am i doing|help me save|suggest", low):
        return reply(insights.advice(db, user_id))

    # --- spending / balance
    if re.search(r"spen[dt]|expense|balance|how much|summary|overview|income", low):
        s = insights.monthly_summary(db, user_id)
        cat_hit = _guess(low, CATEGORY_WORDS, "")
        if cat_hit:
            amt = insights._sum(db, user_id, "expense", insights.month_start(), category=cat_hit)
            return reply(f"You've spent {_money(amt)} on **{cat_hit}** this month.")
        top = insights.category_breakdown(db, user_id)[:3]
        top_txt = "\n".join(f"• {t['category']}: {_money(t['amount'])}" for t in top)
        return reply(
            f"This month so far:\n• Income: {_money(s['total_income'])}\n• Spent: {_money(s['total_expenses'])}\n"
            f"• Net: {_money(s['net_savings'])}" + (f"\n\nTop categories:\n{top_txt}" if top else "")
        )

    if re.search(r"^(hi|hello|hey|yo)\b", low):
        return reply("Hi! 👋 " + HELP)

    return reply("I didn't quite catch that. " + HELP)
