# backend/src/database/db_manager.py
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import pandas as pd
from .models import Base, Transaction, Budget
import os

class DatabaseManager:
    def __init__(self, db_url="sqlite:///finance.db"):
        self.engine = create_engine(db_url, echo=False)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
    
    def add_transaction(self, transaction_data):
        """Add a new transaction"""
        session = self.Session()
        try:
            # Ensure date is datetime
            if 'date' not in transaction_data or transaction_data['date'] is None:
                transaction_data['date'] = datetime.now()
            elif isinstance(transaction_data['date'], str):
                # Handle both ISO format and date-only format
                if 'T' in transaction_data['date']:
                    transaction_data['date'] = datetime.fromisoformat(transaction_data['date'].replace('Z', '+00:00'))
                else:
                    transaction_data['date'] = datetime.strptime(transaction_data['date'], '%Y-%m-%d')
            
            print(f"Creating transaction with data: {transaction_data}")
            
            transaction = Transaction(**transaction_data)
            session.add(transaction)
            session.commit()
            session.refresh(transaction)
            
            result = transaction.to_dict()
            print(f"Transaction created: {result}")
            return result
        except Exception as e:
            print(f"Database error: {str(e)}")
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_transactions(self, limit=50, category=None, start_date=None):
        """Get transactions with optional filters"""
        session = self.Session()
        try:
            query = session.query(Transaction)
            
            if category:
                query = query.filter(Transaction.category == category)
            
            if start_date:
                query = query.filter(Transaction.date >= start_date)
            
            transactions = query.order_by(Transaction.date.desc()).limit(limit).all()
            
            return [t.to_dict() for t in transactions]
        finally:
            session.close()
    
    def delete_transaction(self, transaction_id):
        """Delete a transaction by ID"""
        session = self.Session()
        try:
            transaction = session.query(Transaction).filter(Transaction.id == transaction_id).first()
            if transaction:
                session.delete(transaction)
                session.commit()
                return True
            return False
        finally:
            session.close()
    
    def get_monthly_summary(self):
        """Get summary statistics for current month"""
        session = self.Session()
        try:
            # Current month
            now = datetime.now()
            start_of_month = datetime(now.year, now.month, 1)
            
            total_income = session.query(func.sum(Transaction.amount)).filter(
                Transaction.type == 'income',
                Transaction.date >= start_of_month
            ).scalar() or 0
            
            total_expenses = session.query(func.sum(Transaction.amount)).filter(
                Transaction.type == 'expense',
                Transaction.date >= start_of_month
            ).scalar() or 0
            
            # Last month comparison
            if now.month == 1:
                last_month_start = datetime(now.year - 1, 12, 1)
                last_month_end = datetime(now.year, 1, 1)
            else:
                last_month_start = datetime(now.year, now.month - 1, 1)
                last_month_end = start_of_month
            
            last_month_expenses = session.query(func.sum(Transaction.amount)).filter(
                Transaction.type == 'expense',
                Transaction.date >= last_month_start,
                Transaction.date < last_month_end
            ).scalar() or 0
            
            change = ((total_expenses - last_month_expenses) / last_month_expenses * 100) if last_month_expenses > 0 else 0
            
            return {
                "total_income": float(total_income),
                "total_expenses": float(total_expenses),
                "net_savings": float(total_income - total_expenses),
                "savings_rate": float((total_income - total_expenses) / total_income * 100) if total_income > 0 else 0,
                "expense_change": float(change)
            }
        finally:
            session.close()
    
    def get_category_breakdown(self):
        """Get spending breakdown by category for current month"""
        session = self.Session()
        try:
            now = datetime.now()
            start_of_month = datetime(now.year, now.month, 1)
            
            breakdown = session.query(
                Transaction.category,
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.type == 'expense',
                Transaction.date >= start_of_month
            ).group_by(Transaction.category).all()
            
            return [{"category": cat, "amount": float(total)} for cat, total in breakdown]
        finally:
            session.close()
    
    def get_spending_trends(self):
        """Get spending trends over last 6 months"""
        session = self.Session()
        try:
            # Get last 6 months of data
            six_months_ago = datetime.now() - timedelta(days=180)
            
            transactions = session.query(Transaction).filter(
                Transaction.date >= six_months_ago,
                Transaction.type == 'expense'
            ).all()
            
            # Group by month
            monthly_data = {}
            for t in transactions:
                month_key = t.date.strftime('%Y-%m')
                if month_key not in monthly_data:
                    monthly_data[month_key] = 0
                monthly_data[month_key] += t.amount
            
            return [{"month": k, "amount": v} for k, v in sorted(monthly_data.items())]
        finally:
            session.close()
    
    def get_transactions_df(self):
        """Get transactions as pandas DataFrame for ML"""
        session = self.Session()
        try:
            transactions = session.query(Transaction).all()
            data = [{
                "amount": t.amount,
                "category": t.category,
                "date": t.date,
                "type": t.type,
                "description": t.description
            } for t in transactions]
            return pd.DataFrame(data)
        finally:
            session.close()
    
    def set_budget(self, category, monthly_limit):
        """Create or update budget for a category"""
        session = self.Session()
        try:
            budget = session.query(Budget).filter(Budget.category == category).first()
            if budget:
                budget.monthly_limit = monthly_limit
            else:
                budget = Budget(category=category, monthly_limit=monthly_limit)
                session.add(budget)
            
            session.commit()
            session.refresh(budget)
            return budget.to_dict()
        finally:
            session.close()
    
    def get_budgets(self):
        """Get all budgets"""
        session = self.Session()
        try:
            budgets = session.query(Budget).all()
            return [b.to_dict() for b in budgets]
        finally:
            session.close()
    
    def get_user_financial_data(self):
        """Get comprehensive financial data for AI analysis"""
        session = self.Session()
        try:
            now = datetime.now()
            start_of_month = datetime(now.year, now.month, 1)
            
            # Get monthly spending by category
            breakdown = session.query(
                Transaction.category,
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.type == 'expense',
                Transaction.date >= start_of_month
            ).group_by(Transaction.category).all()
            
            monthly_spending = {cat: float(total) for cat, total in breakdown}
            
            # Get income
            total_income = session.query(func.sum(Transaction.amount)).filter(
                Transaction.type == 'income',
                Transaction.date >= start_of_month
            ).scalar() or 0
            
            total_expenses = sum(monthly_spending.values())
            
            return {
                'monthly_spending': monthly_spending,
                'income': float(total_income),
                'savings_rate': ((total_income - total_expenses) / total_income * 100) if total_income > 0 else 0
            }
        finally:
            session.close()

    # ============ SAVINGS GOALS METHODS ============
    
    def create_savings_goal(self, name, target_amount, deadline=None, description=None):
        """Create a new savings goal"""
        session = self.Session()
        try:
            from .models import SavingsGoal
            
            goal = SavingsGoal(
                name=name,
                target_amount=target_amount,
                deadline=deadline,
                description=description
            )
            session.add(goal)
            session.commit()
            session.refresh(goal)
            return goal.to_dict()
        finally:
            session.close()
    
    def get_savings_goals(self, include_completed=False):
        """Get all savings goals"""
        session = self.Session()
        try:
            from .models import SavingsGoal
            
            query = session.query(SavingsGoal)
            if not include_completed:
                query = query.filter(SavingsGoal.completed == False)
            
            goals = query.order_by(SavingsGoal.created_at.desc()).all()
            return [g.to_dict() for g in goals]
        finally:
            session.close()
    
    def add_to_savings_goal(self, goal_id, amount, description=None):
        """Add money to a savings goal"""
        session = self.Session()
        try:
            from .models import SavingsGoal, SavingsTransaction
            
            goal = session.query(SavingsGoal).filter(SavingsGoal.id == goal_id).first()
            if not goal:
                raise ValueError("Savings goal not found")
            
            # Add transaction
            transaction = SavingsTransaction(
                goal_id=goal_id,
                amount=amount,
                description=description
            )
            session.add(transaction)
            
            # Update goal amount
            goal.current_amount += amount
            
            # Check if goal is completed
            if goal.current_amount >= goal.target_amount:
                goal.completed = True
            
            session.commit()
            session.refresh(goal)
            
            return goal.to_dict()
        finally:
            session.close()
    
    def get_savings_transactions(self, goal_id):
        """Get all transactions for a savings goal"""
        session = self.Session()
        try:
            from .models import SavingsTransaction
            
            transactions = session.query(SavingsTransaction).filter(
                SavingsTransaction.goal_id == goal_id
            ).order_by(SavingsTransaction.date.desc()).all()
            
            return [t.to_dict() for t in transactions]
        finally:
            session.close()
    
    def delete_savings_goal(self, goal_id):
        """Delete a savings goal"""
        session = self.Session()
        try:
            from .models import SavingsGoal, SavingsTransaction
            
            # Delete transactions first
            session.query(SavingsTransaction).filter(
                SavingsTransaction.goal_id == goal_id
            ).delete()
            
            # Delete goal
            goal = session.query(SavingsGoal).filter(SavingsGoal.id == goal_id).first()
            if goal:
                session.delete(goal)
                session.commit()
                return True
            return False
        finally:
            session.close()
    
    # ============ STOCK PORTFOLIO METHODS ============
    
    def add_stock(self, symbol, shares, purchase_price, name=None, purchase_date=None, notes=None):
        """Add a stock holding"""
        session = self.Session()
        try:
            from .models import StockHolding
            
            stock = StockHolding(
                symbol=symbol.upper(),
                name=name,
                shares=shares,
                purchase_price=purchase_price,
                purchase_date=purchase_date if purchase_date else datetime.now(),
                notes=notes
            )
            session.add(stock)
            session.commit()
            session.refresh(stock)
            return stock.to_dict()
        finally:
            session.close()
    
    def get_stocks(self):
        """Get all stock holdings"""
        session = self.Session()
        try:
            from .models import StockHolding
            
            stocks = session.query(StockHolding).order_by(StockHolding.purchase_date.desc()).all()
            return [s.to_dict() for s in stocks]
        finally:
            session.close()
    
    def update_stock(self, stock_id, shares=None, purchase_price=None, notes=None):
        """Update a stock holding"""
        session = self.Session()
        try:
            from .models import StockHolding
            
            stock = session.query(StockHolding).filter(StockHolding.id == stock_id).first()
            if not stock:
                return None
            
            if shares is not None:
                stock.shares = shares
            if purchase_price is not None:
                stock.purchase_price = purchase_price
            if notes is not None:
                stock.notes = notes
            
            session.commit()
            session.refresh(stock)
            return stock.to_dict()
        finally:
            session.close()
    
    def delete_stock(self, stock_id):
        """Delete a stock holding"""
        session = self.Session()
        try:
            from .models import StockHolding
            
            stock = session.query(StockHolding).filter(StockHolding.id == stock_id).first()
            if stock:
                session.delete(stock)
                session.commit()
                return True
            return False
        finally:
            session.close()
    
    def get_portfolio_summary(self):
        """Get portfolio summary with current prices"""
        session = self.Session()
        try:
            from .models import StockHolding
            
            stocks = session.query(StockHolding).all()
            
            total_invested = sum(s.shares * s.purchase_price for s in stocks)
            
            return {
                'total_holdings': len(stocks),
                'total_invested': total_invested,
                'stocks': [s.to_dict() for s in stocks]
            }
        finally:
            session.close()

    # backend/src/database/db_manager.py - ADD these methods

    def get_all_budgets(self):
        """Get all budgets"""
        session = self.Session()
        try:
            from .models import Budget
            
            budgets = session.query(Budget).all()
            return [b.to_dict() for b in budgets]
        finally:
            session.close()
    
    def update_budget(self, budget_id, monthly_limit):
        """Update a budget"""
        session = self.Session()
        try:
            from .models import Budget
            
            budget = session.query(Budget).filter(Budget.id == budget_id).first()
            if not budget:
                return None
            
            budget.monthly_limit = monthly_limit
            session.commit()
            session.refresh(budget)
            return budget.to_dict()
        finally:
            session.close()
    
    def delete_budget(self, budget_id):
        """Delete a budget"""
        session = self.Session()
        try:
            from .models import Budget
            
            budget = session.query(Budget).filter(Budget.id == budget_id).first()
            if budget:
                session.delete(budget)
                session.commit()
                return True
            return False
        finally:
            session.close()