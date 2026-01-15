# backend/src/database/models.py
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Transaction(Base):
    __tablename__ = 'transactions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(DateTime, default=datetime.now, nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(String(500))
    type = Column(String(20), nullable=False)  # income/expense
    tags = Column(String(200))
    
    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat() if self.date else None,
            'amount': self.amount,
            'category': self.category,
            'description': self.description,
            'type': self.type,
            'tags': self.tags
        }


class Budget(Base):
    __tablename__ = 'budgets'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(100), unique=True, nullable=False)
    monthly_limit = Column(Float, nullable=False)
    current_spent = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.now)
    
    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'monthly_limit': self.monthly_limit,
            'current_spent': self.current_spent,
            'remaining': self.monthly_limit - self.current_spent
        }


class SavingsGoal(Base):
    __tablename__ = 'savings_goals'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0)
    deadline = Column(DateTime)
    description = Column(String(500))
    created_at = Column(DateTime, default=datetime.now)
    completed = Column(Boolean, default=False)
    
    def to_dict(self):
        progress = (self.current_amount / self.target_amount * 100) if self.target_amount > 0 else 0
        return {
            'id': self.id,
            'name': self.name,
            'target_amount': self.target_amount,
            'current_amount': self.current_amount,
            'remaining': self.target_amount - self.current_amount,
            'progress': progress,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed': self.completed
        }


class SavingsTransaction(Base):
    __tablename__ = 'savings_transactions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    goal_id = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(DateTime, default=datetime.now)
    description = Column(String(500))
    
    def to_dict(self):
        return {
            'id': self.id,
            'goal_id': self.goal_id,
            'amount': self.amount,
            'date': self.date.isoformat() if self.date else None,
            'description': self.description
        }


class StockHolding(Base):
    __tablename__ = 'stock_holdings'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(10), nullable=False)
    name = Column(String(200))
    shares = Column(Float, nullable=False)
    purchase_price = Column(Float, nullable=False)
    purchase_date = Column(DateTime, default=datetime.now)
    notes = Column(String(500))
    
    def to_dict(self):
        total_cost = self.shares * self.purchase_price
        return {
            'id': self.id,
            'symbol': self.symbol,
            'name': self.name,
            'shares': self.shares,
            'purchase_price': self.purchase_price,
            'total_cost': total_cost,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None,
            'notes': self.notes
        }