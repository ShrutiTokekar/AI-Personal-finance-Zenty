# backend/src/api/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from typing import List, Optional
import sys
import os
import traceback

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.services.stock_service import StockService
from src.nlp.query_processor import QueryProcessor
from src.database.db_manager import DatabaseManager
from src.ml.spending_predictor import SpendingPredictor
from src.ml.anomaly_detector import AnomalyDetector
from src.assistant.financial_advisor import FinancialAdvisor

app = FastAPI(title="AI Finance Assistant API", version="1.0.0")

# CORS middleware - MUST BE BEFORE ROUTES
app.add_middleware(
    CORSMiddleware,
    allow_origins= [
        "http://localhost:5173",
        "http://localhost:3000",
        "*"
    ],  # Allow all origins for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
print("Initializing services...")
db = DatabaseManager()
query_processor = QueryProcessor()
predictor = SpendingPredictor()
anomaly_detector = AnomalyDetector()
advisor = FinancialAdvisor()
print("Services initialized successfully!")

# Pydantic models
class TransactionCreate(BaseModel):
    amount: float
    category: str
    description: Optional[str] = None
    date: Optional[str] = None
    type: str = "expense"

class ChatMessage(BaseModel):
    message: str

class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float

class SavingsGoalCreate(BaseModel):
    name: str
    target_amount: float
    deadline: Optional[str] = None
    description: Optional[str] = None

class SavingsContribution(BaseModel):
    amount: float
    description: Optional[str] = None

class StockCreate(BaseModel):
    symbol: str
    shares: float
    purchase_price: float
    name: Optional[str] = None
    purchase_date: Optional[str] = None
    notes: Optional[str] = None

# Routes
@app.get("/")
async def root():
    return {
        "message": "AI Finance Assistant API", 
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/api/transactions")
async def create_transaction(transaction: TransactionCreate):
    """Add a new transaction"""
    try:
        print("=" * 50)
        print("Received transaction request:")
        print(f"Raw data: {transaction.dict()}")
        
        # Convert transaction to dict
        transaction_data = transaction.dict()
        
        # Handle date conversion
        if transaction_data.get('date'):
            try:
                date_str = transaction_data['date']
                print(f"Parsing date: {date_str}")
                
                if 'T' in date_str:
                    transaction_data['date'] = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                else:
                    transaction_data['date'] = datetime.strptime(date_str, '%Y-%m-%d')
                
                print(f"Parsed date: {transaction_data['date']}")
            except Exception as date_error:
                print(f"Date parsing error: {date_error}")
                transaction_data['date'] = datetime.now()
        else:
            transaction_data['date'] = datetime.now()
        
        print(f"Processed transaction data: {transaction_data}")
        
        # Add to database
        result = db.add_transaction(transaction_data)
        print(f"Transaction added successfully: {result}")
        
        # Check for anomalies (don't let this fail the transaction)
        is_anomaly = False
        try:
            is_anomaly = anomaly_detector.detect_anomaly(transaction_data)
            print(f"Anomaly detection result: {is_anomaly}")
        except Exception as anomaly_error:
            print(f"Anomaly detection error (non-critical): {anomaly_error}")
        
        response = {
            "success": True,
            "transaction": result,
            "anomaly_detected": is_anomaly
        }
        print(f"Sending response: {response}")
        print("=" * 50)
        
        return response
        
    except Exception as e:
        print("=" * 50)
        print(f"ERROR adding transaction: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        traceback.print_exc()
        print("=" * 50)
        raise HTTPException(status_code=400, detail=f"Failed to add transaction: {str(e)}")

@app.get("/api/transactions")
async def get_transactions(
    limit: int = 50,
    category: Optional[str] = None,
    start_date: Optional[str] = None
):
    """Get transactions with optional filters"""
    try:
        print(f"Fetching transactions - limit: {limit}, category: {category}, start_date: {start_date}")
        transactions = db.get_transactions(limit, category, start_date)
        print(f"Retrieved {len(transactions)} transactions")
        return {"transactions": transactions}
    except Exception as e:
        print(f"Error fetching transactions: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int):
    """Delete a transaction"""
    try:
        print(f"Deleting transaction ID: {transaction_id}")
        result = db.delete_transaction(transaction_id)
        if result:
            print(f"Transaction {transaction_id} deleted successfully")
            return {"success": True, "message": "Transaction deleted"}
        print(f"Transaction {transaction_id} not found")
        raise HTTPException(status_code=404, detail="Transaction not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting transaction: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/summary")
async def get_summary():
    """Get financial summary statistics"""
    try:
        print("Fetching financial summary...")
        summary = db.get_monthly_summary()
        print(f"Summary: {summary}")
        return summary
    except Exception as e:
        print(f"Error fetching summary: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/trends")
async def get_trends():
    """Get spending trends over time"""
    try:
        print("Fetching spending trends...")
        trends = db.get_spending_trends()
        print(f"Retrieved {len(trends)} trend data points")
        return {"trends": trends}
    except Exception as e:
        print(f"Error fetching trends: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/category-breakdown")
async def get_category_breakdown():
    """Get spending breakdown by category"""
    try:
        print("Fetching category breakdown...")
        breakdown = db.get_category_breakdown()
        print(f"Retrieved breakdown for {len(breakdown)} categories")
        return {"breakdown": breakdown}
    except Exception as e:
        print(f"Error fetching category breakdown: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/predict/next-month")
async def predict_next_month():
    """Predict spending for next month"""
    try:
        print("Generating spending predictions...")
        transactions_df = db.get_transactions_df()
        
        if len(transactions_df) < 30:
            print(f"Insufficient data: only {len(transactions_df)} transactions")
            return {
                "error": "Need at least 30 transactions for accurate predictions",
                "predictions": {}
            }
        
        print(f"Training predictor with {len(transactions_df)} transactions")
        trained = predictor.train(transactions_df)
        
        if not trained:
            print("Predictor training failed")
            return {
                "error": "Insufficient data for training",
                "predictions": {}
            }
        
        predictions = predictor.predict_next_month_all_categories()
        print(f"Generated predictions for {len(predictions)} categories")
        
        return {"predictions": predictions}
    except Exception as e:
        print(f"Error in predictions: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/budget")
async def get_budgets():
    """Get all budget limits"""
    try:
        print("Fetching budgets...")
        budgets = db.get_budgets()
        print(f"Retrieved {len(budgets)} budgets")
        return {"budgets": budgets}
    except Exception as e:
        print(f"Error fetching budgets: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/budget")
async def create_budget(budget: BudgetCreate):
    """Create or update budget limit"""
    try:
        print(f"Creating/updating budget: {budget.dict()}")
        result = db.set_budget(budget.category, budget.monthly_limit)
        print(f"Budget saved: {result}")
        return {"success": True, "budget": result}
    except Exception as e:
        print(f"Error creating budget: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/chat")
async def chat(message: ChatMessage):
    """Process natural language query"""
    try:
        print(f"Processing chat message: {message.message}")
        response = query_processor.process(message.message)
        print(f"Chat response: {response}")
        return response
    except Exception as e:
        print(f"Chat error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/advice")
async def get_advice():
    """Get AI-powered financial advice"""
    try:
        print("Generating financial advice...")
        user_data = db.get_user_financial_data()
        print(f"User data: {user_data}")
        advice = advisor.get_personalized_advice(user_data)
        print(f"Advice generated: {advice[:100]}...")
        return {"advice": advice}
    except Exception as e:
        print(f"Error generating advice: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/anomalies")
async def detect_anomalies():
    """Detect unusual transactions"""
    try:
        print("Detecting anomalies...")
        transactions_df = db.get_transactions_df()
        
        if len(transactions_df) < 50:
            print(f"Insufficient data for anomaly detection: {len(transactions_df)} transactions")
            return {"anomalies": [], "message": "Need at least 50 transactions"}
        
        print(f"Training anomaly detector with {len(transactions_df)} transactions")
        trained = anomaly_detector.train(transactions_df)
        
        if not trained:
            print("Anomaly detector training failed")
            return {"anomalies": [], "message": "Insufficient data for training"}
        
        anomalies = anomaly_detector.get_unusual_transactions(transactions_df)
        print(f"Detected {len(anomalies)} anomalies")
        
        return {"anomalies": anomalies.to_dict('records') if len(anomalies) > 0 else []}
    except Exception as e:
        print(f"Error detecting anomalies: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# =========== SAVINGS GOALS ROUTES ============

@app.get("/api/savings/goals")
async def get_savings_goals(include_completed: bool = False):
    """Get all savings goals"""
    try:
        goals = db.get_savings_goals(include_completed)
        return {"goals": goals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/savings/goals")
async def create_savings_goal(goal: SavingsGoalCreate):
    """Create a new savings goal"""
    try:
        from datetime import datetime
        deadline = None
        if goal.deadline:
            deadline = datetime.fromisoformat(goal.deadline.replace('Z', '+00:00'))
        
        result = db.create_savings_goal(
            name=goal.name,
            target_amount=goal.target_amount,
            deadline=deadline,
            description=goal.description
        )
        return {"success": True, "goal": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/savings/goals/{goal_id}/contribute")
async def contribute_to_goal(goal_id: int, contribution: SavingsContribution):
    """Add money to a savings goal"""
    try:
        result = db.add_to_savings_goal(goal_id, contribution.amount, contribution.description)
        return {"success": True, "goal": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/savings/goals/{goal_id}/transactions")
async def get_goal_transactions(goal_id: int):
    """Get all transactions for a savings goal"""
    try:
        transactions = db.get_savings_transactions(goal_id)
        return {"transactions": transactions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/savings/goals/{goal_id}")
async def delete_savings_goal(goal_id: int):
    """Delete a savings goal"""
    try:
        result = db.delete_savings_goal(goal_id)
        if result:
            return {"success": True, "message": "Goal deleted"}
        raise HTTPException(status_code=404, detail="Goal not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ STOCK PORTFOLIO ROUTES ============

@app.get("/api/stocks")
async def get_stocks():
    """Get all stock holdings"""
    try:
        stocks = db.get_stocks()
        return {"stocks": stocks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/stocks")
async def add_stock(stock: StockCreate):
    """Add a stock holding"""
    try:
        from datetime import datetime
        purchase_date = None
        if stock.purchase_date:
            purchase_date = datetime.fromisoformat(stock.purchase_date.replace('Z', '+00:00'))
        
        result = db.add_stock(
            symbol=stock.symbol,
            shares=stock.shares,
            purchase_price=stock.purchase_price,
            name=stock.name,
            purchase_date=purchase_date,
            notes=stock.notes
        )
        return {"success": True, "stock": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/stocks/{stock_id}")
async def delete_stock(stock_id: int):
    """Delete a stock holding"""
    try:
        result = db.delete_stock(stock_id)
        if result:
            return {"success": True, "message": "Stock deleted"}
        raise HTTPException(status_code=404, detail="Stock not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stocks/portfolio")
async def get_portfolio():
    """Get portfolio summary"""
    try:
        summary = db.get_portfolio_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stocks/validate/{symbol}")
async def validate_stock_symbol(symbol: str):
    """Validate if a stock symbol exists"""
    try:
        symbol = symbol.upper()
        print(f"API: Validating symbol {symbol}")  # Debug log
        
        is_valid = StockService.validate_symbol(symbol)
        
        return {
            "symbol": symbol, 
            "valid": is_valid,
            "message": "Valid symbol" if is_valid else "Invalid or unknown symbol"
        }
    except Exception as e:
        print(f"API validation error: {str(e)}")  # Debug log
        raise HTTPException(
            status_code=500, 
            detail=f"Error validating symbol: {str(e)}"
        )
    
@app.get("/api/stocks/price/{symbol}")
async def get_stock_price(symbol: str):
    """Get current price for a stock"""
    try:
        symbol = symbol.upper()
        print(f"API: Fetching price for {symbol}")  # Debug log
        
        stock_info = StockService.get_stock_info(symbol)
        
        if not stock_info:
            raise HTTPException(
                status_code=404, 
                detail=f"Stock symbol '{symbol}' not found or no price data available"
            )
        
        return stock_info
    except HTTPException:
        raise
    except Exception as e:
        print(f"API price fetch error: {str(e)}")  # Debug log
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching stock price: {str(e)}"
        )
    
# backend/src/api/main.py - ADD these routes

@app.get("/api/budgets")
async def get_budgets():
    """Get all budgets"""
    try:
        budgets = db.get_all_budgets()
        return {"budgets": budgets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/budgets")
async def create_budget(category: str, monthly_limit: float):
    """Create a new budget"""
    try:
        result = db.set_budget(category, monthly_limit)
        return {"success": True, "budget": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/budgets/{budget_id}")
async def update_budget(budget_id: int, monthly_limit: float):
    """Update a budget"""
    try:
        result = db.update_budget(budget_id, monthly_limit)
        if result:
            return {"success": True, "budget": result}
        raise HTTPException(status_code=404, detail="Budget not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/budgets/{budget_id}")
async def delete_budget(budget_id: int):
    """Delete a budget"""
    try:
        result = db.delete_budget(budget_id)
        if result:
            return {"success": True}
        raise HTTPException(status_code=404, detail="Budget not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/budgets/summary")
async def get_budget_summary():
    """Get budget summary"""
    try:
        budgets = db.get_all_budgets()
        total_budget = sum(b['monthly_limit'] for b in budgets)
        total_spent = sum(b['current_spent'] for b in budgets)
        total_remaining = sum(b['remaining'] for b in budgets)
        
        return {
            "total_budget": total_budget,
            "total_spent": total_spent,
            "total_remaining": total_remaining,
            "budgets": budgets
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("=" * 70)
    print("Starting AI Finance Assistant API...")
    print("API will be available at: http://localhost:8000")
    print("API documentation at: http://localhost:8000/docs")
    print("=" * 70)
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)