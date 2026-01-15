# backend/src/ml/spending_predictor.py
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import pandas as pd
from datetime import datetime

class SpendingPredictor:
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.category_encoder = LabelEncoder()
        self.trained = False
    
    def prepare_features(self, transactions_df):
        """Create features from transaction history"""
        if len(transactions_df) == 0:
            return pd.DataFrame()
        
        df = transactions_df.copy()
        
        # Ensure date is datetime
        df['date'] = pd.to_datetime(df['date'])
        
        # Time-based features
        df['day_of_week'] = df['date'].dt.dayofweek
        df['day_of_month'] = df['date'].dt.day
        df['month'] = df['date'].dt.month
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # Sort by date
        df = df.sort_values('date')
        
        # Spending patterns - rolling average
        df['avg_last_7_days'] = df.groupby('category')['amount'].transform(
            lambda x: x.rolling(7, min_periods=1).mean()
        )
        
        # Encode categories
        if len(df['category'].unique()) > 0:
            df['category_encoded'] = self.category_encoder.fit_transform(df['category'])
        else:
            df['category_encoded'] = 0
        
        return df
    
    def train(self, transactions_df):
        """Train on historical spending data"""
        if len(transactions_df) < 10:
            return False
        
        # Only use expenses for training
        df = transactions_df[transactions_df['type'] == 'expense'].copy()
        
        if len(df) < 10:
            return False
        
        df = self.prepare_features(df)
        
        features = ['day_of_week', 'day_of_month', 'month', 
                   'is_weekend', 'category_encoded', 'avg_last_7_days']
        
        # Remove any rows with NaN values
        df = df.dropna(subset=features + ['amount'])
        
        if len(df) < 10:
            return False
        
        X = df[features]
        y = df['amount']
        
        self.model.fit(X, y)
        self.trained = True
        return True
    
    def predict_next_month_all_categories(self):
        """Predict spending for next month across all categories"""
        if not self.trained:
            return {}
        
        predictions = {}
        
        # Get current date
        now = datetime.now()
        
        # Predict for common categories
        for category in self.category_encoder.classes_:
            try:
                category_encoded = self.category_encoder.transform([category])[0]
                
                # Sample predictions for next 30 days
                daily_predictions = []
                for day in range(1, 31):
                    day_of_week = (now.weekday() + day) % 7
                    is_weekend = 1 if day_of_week in [5, 6] else 0
                    
                    features = [[
                        day_of_week,
                        day % 28 + 1,  # day of month
                        (now.month % 12) + 1,  # next month
                        is_weekend,
                        category_encoded,
                        50.0  # average spending placeholder
                    ]]
                    
                    pred = self.model.predict(features)[0]
                    daily_predictions.append(max(0, pred))  # Ensure non-negative
                
                predictions[category] = {
                    'total': sum(daily_predictions),
                    'daily_avg': np.mean(daily_predictions),
                    'max_day': max(daily_predictions)
                }
            except:
                continue
        
        return predictions