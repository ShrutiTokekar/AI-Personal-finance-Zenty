# src/ml/budget_optimizer.py
from scipy.optimize import minimize
import numpy as np

class BudgetOptimizer:
    def __init__(self):
        self.categories = []
        self.historical_spending = {}
    
    def optimize_budget(self, total_income, historical_data, savings_goal=0.2):
        """
        Optimize budget allocation across categories
        to maximize satisfaction while meeting savings goal
        """
        categories = historical_data['category'].unique()
        
        # Calculate average spending per category
        avg_spending = historical_data.groupby('category')['amount'].mean()
        
        # Define objective: minimize deviation from preferred spending
        # while meeting savings constraint
        def objective(allocation):
            # Penalize deviation from historical patterns
            deviation = np.sum((allocation - avg_spending.values) ** 2)
            return deviation
        
        # Constraints
        constraints = [
            {'type': 'eq', 'fun': lambda x: np.sum(x) - total_income * (1 - savings_goal)},
            {'type': 'ineq', 'fun': lambda x: x}  # All positive
        ]
        
        # Initial guess: current spending pattern
        x0 = avg_spending.values
        
        # Optimize
        result = minimize(objective, x0, constraints=constraints, method='SLSQP')
        
        return dict(zip(categories, result.x))