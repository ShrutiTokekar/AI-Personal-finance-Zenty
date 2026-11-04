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
    "• \"delete my last transaction\"\n"
    "• \"make me a budget plan\" or \"plan my goals\"\n"
    "• \"predict next month\" or \"give me advice\""
)

NEEDS = ("rent", "bill", "utilit", "grocer", "transport", "health", "insurance", "loan", "mortgage", "medical", "gas")


def _is_need(category: str) -> bool:
    c = category.lower()
    return any(k in c for k in NEEDS)


def _monthly_averages(db: Session, user_id: int, months: int = 3):
    """Average monthly income and spending per category over recent complete months
    (falls back to this month if there is no history yet)."""
    from collections import defaultdict
    start = insights.month_start()
    since = start
    for _ in range(months):  # step back whole calendar months
        since = insights.prev_month_start(since)
    rows = db.query(Transaction).filter(Transaction.user_id == user_id, Transaction.date >= since, Transaction.date < start).all()
    span = len({t.date.strftime("%Y-%m") for t in rows}) or 0
    if span == 0:
        rows = db.query(Transaction).filter(Transaction.user_id == user_id, Transaction.date >= start).all()
        span = 1
    income = sum(t.amount for t in rows if t.type == "income") / span
    cats: dict[str, float] = defaultdict(float)
    for t in rows:
        if t.type == "expense":
            cats[t.category] += t.amount / span
    return income, dict(cats)


def _budget_plan(db: Session, user_id: int) -> dict:
    income, cats = _monthly_averages(db, user_id)
    if not cats:
        return {"type": "text", "message": "I need a few weeks of spending to build a plan. Log some expenses or link your bank, then ask again."}
    needs = {c: v for c, v in cats.items() if _is_need(c)}
    wants = {c: v * 0.85 for c, v in cats.items() if not _is_need(c)}  # trim wants by 15%
    if income > 0:
        cap = income * 0.30
        if sum(wants.values()) > cap:
            scale = cap / sum(wants.values())
            wants = {c: v * scale for c, v in wants.items()}
    plan = {**{c: round(v / 5) * 5 or 5 for c, v in needs.items()}, **{c: round(v / 5) * 5 or 5 for c, v in wants.items()}}
    lines = []
    if income > 0:
        save = income - sum(plan.values())
        lines.append(f"Based on your last few months, you bring in about {_money(income)}/month.")
        lines.append(f"• Needs (bills, groceries, transport): {_money(sum(needs.values()))} ({sum(needs.values()) / income * 100:.0f}%)")
        lines.append(f"• Wants, trimmed 15%: {_money(sum(plan[c] for c in wants))} ({sum(plan[c] for c in wants) / income * 100:.0f}%)")
        lines.append(f"• That leaves {_money(save)}/month to save ({save / income * 100:.0f}%). The 50/30/20 rule aims for 20%+.")
    else:
        lines.append("Here's a plan based on your recent spending, with wants trimmed by 15%.")
    lines.append("")
    lines.append("Suggested monthly budgets:")
    for c, v in sorted(plan.items(), key=lambda kv: -kv[1])[:8]:
        lines.append(f"• {c}: {_money(v)}")
    return {
        "type": "plan",
        "message": "\n".join(lines),
        "actions": [{"label": "Apply these budgets", "kind": "apply_budgets",
                     "budgets": [{"category": c, "monthly_limit": v} for c, v in plan.items()]}],
    }


def _goal_plan(db: Session, user_id: int) -> dict:
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id, SavingsGoal.completed.is_(False)).all()
    if not goals:
        return {"type": "text", "message": "You don't have any active goals yet. Try \"create goal emergency fund 5000\" and I'll plan it with you."}
    income, cats = _monthly_averages(db, user_id)
    spare = max(0.0, income - sum(cats.values()))
    lines = ["Here's your goals game plan:"]
    now = utcnow()
    for g in goals:
        left = max(0.0, g.target_amount - g.current_amount)
        if g.deadline and g.deadline > now:
            months = max(1, (g.deadline.year - now.year) * 12 + g.deadline.month - now.month)
            lines.append(f"• {g.name}: save {_money(left / months)}/month for {months} months to hit {_money(g.target_amount)} on time.")
        elif spare > 0:
            per = spare / len(goals) * 0.5
            months = left / per if per else 0
            lines.append(f"• {g.name}: putting {_money(per)}/month toward it gets you there in about {months:.0f} months.")
        else:
            lines.append(f"• {g.name}: {_money(left)} to go. Free up room in your budget, or set a deadline and I'll work out the monthly amount.")
    if spare > 0:
        lines.append(f"\nYou have roughly {_money(spare)}/month left after spending, so these are realistic.")
    return {"type": "text", "message": "\n".join(lines)}


def _find_transaction(db: Session, user_id: int, low: str):
    recent = db.query(Transaction).filter(Transaction.user_id == user_id).order_by(Transaction.date.desc(), Transaction.id.desc()).limit(80).all()
    if not recent:
        return None
    if re.search(r"\b(last|latest|recent|undo|previous)\b", low):
        return recent[0]
    amt = _amount(low)
    words = [w for w in re.findall(r"[a-z]{3,}", low) if w not in {"delete", "remove", "transaction", "the", "my", "for", "and", "that", "this", "expense", "income", "spent", "charge"}]
    for t in recent:
        text = f"{t.description or ''} {t.category}".lower()
        if amt is not None and abs(t.amount - amt) > 0.005:
            continue
        if words and not any(w in text for w in words):
            continue
        if amt is None and not words:
            continue
        return t
    return None


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

    # --- delete a transaction (always asks to confirm in the app)
    if re.search(r"\b(delete|remove|undo|cancel)\b", low) and not re.search(r"\b(budget|goal|stock|account)s?\b", low):
        t = _find_transaction(db, user_id, low)
        if not t:
            return reply("I couldn't find that one. Try \"delete my last transaction\" or \"delete the 4.50 coffee\".")
        when = f"{t.date:%b} {t.date.day}" if t.date else ""
        sign = "+" if t.type == "income" else "−"
        return {"type": "confirm",
                "message": f"Delete {t.description or t.category} ({sign}{_money(t.amount)}, {when})?",
                "actions": [{"label": "Yes, delete", "kind": "delete_transaction", "id": t.id},
                            {"label": "Keep it", "kind": "dismiss"}]}

    # --- game plans
    if re.search(r"game ?plan|budget(ing)? plan|plan (my|a) budget|help me budget|make (me )?a budget|50/30/20", low):
        return _budget_plan(db, user_id)
    if re.search(r"plan (my|for my)? ?goals?|goals? plan|reach my goals?|how (long|soon).*goal", low):
        return _goal_plan(db, user_id)

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
