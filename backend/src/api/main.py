# backend/src/api/main.py
import os
import sys
import threading
import traceback
from typing import Optional, List
from datetime import datetime

print("=" * 60)
print("🚀 STARTING AI FINANCE API")
print("=" * 60)

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float

class BudgetUpdate(BaseModel):
    monthly_limit: float

app = FastAPI(title="AI Finance Assistant API", version="1.0.0")

# CORS middleware - MUST BE BEFORE ROUTES
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("✅ FastAPI app created with CORS")

# Initialize ONLY lightweight services immediately
from src.database.db_manager import DatabaseManager
db = DatabaseManager()
print("✅ Database initialized")

# Heavy ML services - initialize as None (lazy loading)
query_processor = None
predictor = None
anomaly_detector = None
advisor = None
stock_service = None

# ML loading state
ml_loading = False
ml_loaded = False

def load_ml_models():
    """Load ML models in background after server starts"""
    global query_processor, predictor, anomaly_detector, advisor, stock_service
    global ml_loading, ml_loaded
    
    if ml_loading or ml_loaded:
        return
    
    ml_loading = True
    print("📚 Loading ML models in background (this takes 30-60 seconds)...")
    
    try:
        print("  → Loading Query Processor...")
        from src.nlp.query_processor import QueryProcessor
        query_processor = QueryProcessor()
        print("  ✓ Query Processor ready")
        
        print("  → Loading Stock Service...")
        from src.services.stock_service import StockService
        stock_service = StockService
        print("  ✓ Stock Service ready")
        
        print("  → Loading Spending Predictor...")
        from src.ml.spending_predictor import SpendingPredictor
        predictor = SpendingPredictor()
        print("  ✓ Spending Predictor ready")
        
        print("  → Loading Anomaly Detector...")
        from src.ml.anomaly_detector import AnomalyDetector
        anomaly_detector = AnomalyDetector()
        print("  ✓ Anomaly Detector ready")
        
        print("  → Loading Financial Advisor...")
        from src.assistant.financial_advisor import FinancialAdvisor
        advisor = FinancialAdvisor()
        print("  ✓ Financial Advisor ready")
        
        ml_loaded = True
        print("✅ All ML models loaded successfully!")
        
    except Exception as e:
        print(f"⚠️ ML loading error: {e}")
        traceback.print_exc()
    finally:
        ml_loading = False

@app.on_event("startup")
async def startup_event():
    """Start ML loading in background after server starts"""
    print("🎬 Server started! Loading ML models in background...")
    thread = threading.Thread(target=load_ml_models, daemon=True)
    thread.start()

# Helper functions for lazy loading
def get_query_processor():
    """Get query processor (waits if still loading)"""
    if ml_loaded and query_processor:
        return query_processor
    
    if ml_loading:
        # Still loading, wait a bit
        import time
        for _ in range(30):
            time.sleep(1)
            if ml_loaded:
                return query_processor
    
    # If not loading yet, trigger it
    if not ml_loading:
        load_ml_models()
    
    return query_processor

def get_predictor():
    """Get predictor (waits if still loading)"""
    if ml_loaded and predictor:
        return predictor
    
    if ml_loading:
        import time
        for _ in range(30):
            time.sleep(1)
            if ml_loaded:
                return predictor
    
    if not ml_loading:
        load_ml_models()
    
    return predictor

def get_anomaly_detector():
    """Get anomaly detector (waits if still loading)"""
    if ml_loaded and anomaly_detector:
        return anomaly_detector
    
    if ml_loading:
        import time
        for _ in range(30):
            time.sleep(1)
            if ml_loaded:
                return anomaly_detector
    
    if not ml_loading:
        load_ml_models()
    
    return anomaly_detector

def get_advisor():
    """Get financial advisor (waits if still loading)"""
    if ml_loaded and advisor:
        return advisor
    
    if ml_loading:
        import time
        for _ in range(30):
            time.sleep(1)
            if ml_loaded:
                return advisor
    
    if not ml_loading:
        load_ml_models()
    
    return advisor

print("=" * 60)
print("✅ SERVER READY - ML will load in background")
print(f"   Port: {os.getenv('PORT', 'NOT SET')}")
print("=" * 60)

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

# Fast endpoints (no ML needed)
@app.get("/")
async def root():
    return {
        "message": "AI Finance Assistant API",
        "status": "running",
        "version": "1.0.0",
        "ml_status": "loaded" if ml_loaded else "loading..." if ml_loading else "waiting",
        "port": os.getenv("PORT", "unknown")
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ml_loaded": ml_loaded,
        "ml_loading": ml_loading
    }

# Transaction routes (no ML needed)
@app.post("/api/transactions")
async def create_transaction(transaction: TransactionCreate):
    """Add a new transaction"""
    try:
        print("=" * 50)
        print("Received transaction request:")
        print(f"Raw data: {transaction.dict()}")
        
        transaction_data = transaction.dict()
        
        # Handle date conversion
        if transaction_data.get('date'):
            try:
                date_str = transaction_data['date']
                if 'T' in date_str:
                    transaction_data['date'] = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                else:
                    transaction_data['date'] = datetime.strptime(date_str, '%Y-%m-%d')
            except Exception as date_error:
                print(f"Date parsing error: {date_error}")
                transaction_data['date'] = datetime.now()
        else:
            transaction_data['date'] = datetime.now()
        
        # Add to database
        result = db.add_transaction(transaction_data)
        print(f"Transaction added successfully: {result}")
        
        # Check for anomalies (lazy load if needed)
        is_anomaly = False
        if ml_loaded:
            try:
                detector = get_anomaly_detector()
                if detector:
                    is_anomaly = detector.detect_anomaly(transaction_data)
            except Exception as anomaly_error:
                print(f"Anomaly detection error (non-critical): {anomaly_error}")
        
        response = {
            "success": True,
            "transaction": result,
            "anomaly_detected": is_anomaly
        }
        print("=" * 50)
        
        return response
        
    except Exception as e:
        print(f"ERROR adding transaction: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Failed to add transaction: {str(e)}")

@app.get("/api/transactions")
async def get_transactions(
    limit: int = 50,
    category: Optional[str] = None,
    start_date: Optional[str] = None
):
    """Get transactions with optional filters"""
    try:
        transactions = db.get_transactions(limit, category, start_date)
        return {"transactions": transactions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int):
    """Delete a transaction"""
    try:
        result = db.delete_transaction(transaction_id)
        if result:
            return {"success": True, "message": "Transaction deleted"}
        raise HTTPException(status_code=404, detail="Transaction not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/summary")
async def get_summary():
    """Get financial summary statistics"""
    try:
        summary = db.get_monthly_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/trends")
async def get_trends():
    """Get spending trends over time"""
    try:
        trends = db.get_spending_trends()
        return {"trends": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/category-breakdown")
async def get_category_breakdown():
    """Get spending breakdown by category"""
    try:
        breakdown = db.get_category_breakdown()
        return {"breakdown": breakdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ML-powered routes (lazy load)
@app.get("/api/predict/next-month")
async def predict_next_month():
    """Predict spending for next month"""
    try:
        pred = get_predictor()
        if not pred:
            return {
                "error": "ML models are still loading. Please try again in a moment.",
                "predictions": {}
            }
        
        transactions_df = db.get_transactions_df()
        
        if len(transactions_df) < 30:
            return {
                "error": "Need at least 30 transactions for accurate predictions",
                "predictions": {}
            }
        
        trained = pred.train(transactions_df)
        
        if not trained:
            return {
                "error": "Insufficient data for training",
                "predictions": {}
            }
        
        predictions = pred.predict_next_month_all_categories()
        return {"predictions": predictions}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(message: ChatMessage):
    """Process natural language query"""
    try:
        processor = get_query_processor()
        
        if not processor:
            return {
                'type': 'text',
                'message': '⏳ AI models are still loading (takes ~1 minute on first start). Please try again in a moment!'
            }
        
        response = processor.process(message.message)
        return response
    except Exception as e:
        traceback.print_exc()
        return {
            'type': 'text',
            'message': f'Sorry, I encountered an error: {str(e)}'
        }

@app.get("/api/advice")
async def get_advice():
    """Get AI-powered financial advice"""
    try:
        adv = get_advisor()
        
        if not adv:
            return {
                "advice": "AI advisor is still loading. Please try again in a moment."
            }
        
        user_data = db.get_user_financial_data()
        advice = adv.get_personalized_advice(user_data)
        return {"advice": advice}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/anomalies")
async def detect_anomalies():
    """Detect unusual transactions"""
    try:
        detector = get_anomaly_detector()
        
        if not detector:
            return {
                "anomalies": [],
                "message": "Anomaly detector is still loading. Please try again in a moment."
            }
        
        transactions_df = db.get_transactions_df()
        
        if len(transactions_df) < 50:
            return {"anomalies": [], "message": "Need at least 50 transactions"}
        
        trained = detector.train(transactions_df)
        
        if not trained:
            return {"anomalies": [], "message": "Insufficient data for training"}
        
        anomalies = detector.get_unusual_transactions(transactions_df)
        
        return {"anomalies": anomalies.to_dict('records') if len(anomalies) > 0 else []}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Budget routes
@app.get("/api/budgets")
async def get_budgets():
    """Get all budgets"""
    try:
        budgets = db.get_all_budgets()
        return {"budgets": budgets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/budgets")
async def create_budget(budget: BudgetCreate):
    """Create a new budget"""
    try:
        result = db.set_budget(budget.category, budget.monthly_limit)
        return {"success": True, "budget": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/budgets/{budget_id}")
async def update_budget(budget_id: int, request: BudgetUpdate):
    """Update a budget"""
    try:
        result = db.update_budget(budget_id, request.monthly_limit)
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
    
# Savings Goals routes
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

# Stock routes (lazy load for validation)
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
        
        # Stock service loaded on-demand
        from src.services.stock_service import StockService
        is_valid = StockService.validate_symbol(symbol)
        
        return {
            "symbol": symbol,
            "valid": is_valid,
            "message": "Valid symbol" if is_valid else "Invalid or unknown symbol"
        }
    except Exception as e:
        print(f"API validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error validating symbol: {str(e)}")

@app.get("/api/stocks/price/{symbol}")
async def get_stock_price(symbol: str):
    """Get current price for a stock"""
    try:
        symbol = symbol.upper()
        
        # Stock service loaded on-demand
        from src.services.stock_service import StockService
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
        print(f"API price fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching stock price: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    print("=" * 70)
    print("Starting AI Finance Assistant API...")
    print("API will be available at: http://localhost:8000")
    print("API documentation at: http://localhost:8000/docs")
    print("=" * 70)
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)