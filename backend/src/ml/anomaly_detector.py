# backend/src/ml/anomaly_detector.py
from sklearn.ensemble import IsolationForest
import numpy as np
import pandas as pd

class AnomalyDetector:
    def __init__(self):
        self.model = IsolationForest(contamination=0.1, random_state=42)
        self.trained = False
        self.category_stats = {}
    
    def train(self, transactions_df):
        """Learn normal spending patterns"""
        if len(transactions_df) < 20:
            return False
        
        # Only use expenses
        df = transactions_df[transactions_df['type'] == 'expense'].copy()
        
        if len(df) < 20:
            return False
        
        # Calculate statistics per category
        for category in df['category'].unique():
            cat_data = df[df['category'] == category]['amount']
            self.category_stats[category] = {
                'mean': cat_data.mean(),
                'std': cat_data.std(),
                'max': cat_data.max()
            }
        
        # Prepare features for isolation forest
        df['day_of_week'] = pd.to_datetime(df['date']).dt.dayofweek
        
        # Create numerical encoding for categories
        df['category_num'] = pd.Categorical(df['category']).codes
        
        features = df[['amount', 'day_of_week', 'category_num']].values
        
        self.model.fit(features)
        self.trained = True
        return True
    
    def detect_anomaly(self, transaction):
        """Check if a transaction is unusual"""
        if not self.trained:
            # Simple rule-based anomaly detection
            category = transaction.get('category', 'other')
            amount = transaction.get('amount', 0)
            
            if category in self.category_stats:
                stats = self.category_stats[category]
                # Flag if amount is > 2 standard deviations from mean
                if amount > stats['mean'] + 2 * stats['std']:
                    return True
            elif amount > 200:  # High amount for unknown category
                return True
            
            return False
        
        # Use trained model
        try:
            date = transaction.get('date', pd.Timestamp.now())
            if isinstance(date, str):
                date = pd.to_datetime(date)
            
            day_of_week = date.dayofweek if hasattr(date, 'dayofweek') else 0
            category_num = hash(transaction.get('category', 'other')) % 100
            
            features = [[
                transaction.get('amount', 0),
                day_of_week,
                category_num
            ]]
            
            prediction = self.model.predict(features)[0]
            return prediction == -1  # -1 means anomaly
        except:
            return False
    
    def get_unusual_transactions(self, transactions_df):
        """Find all unusual transactions in a dataset"""
        if not self.trained or len(transactions_df) == 0:
            return pd.DataFrame()
        
        df = transactions_df.copy()
        df['day_of_week'] = pd.to_datetime(df['date']).dt.dayofweek
        df['category_num'] = pd.Categorical(df['category']).codes
        
        features = df[['amount', 'day_of_week', 'category_num']].values
        predictions = self.model.predict(features)
        
        unusual = df[predictions == -1].copy()
        unusual['anomaly_reason'] = unusual.apply(
            lambda row: self._explain_anomaly(row), axis=1
        )
        
        return unusual
    
    def _explain_anomaly(self, transaction):
        """Explain why a transaction is unusual"""
        category = transaction['category']
        amount = transaction['amount']
        
        if category in self.category_stats:
            stats = self.category_stats[category]
            ratio = amount / stats['mean'] if stats['mean'] > 0 else 0
            
            if ratio > 2:
                return f"Amount is {ratio:.1f}x higher than usual for {category}"
            elif amount > stats['max']:
                return f"This is your highest {category} transaction"
            else:
                return f"Unusual spending pattern for {category}"
        
        return "Unusual transaction detected"