# backend/src/nlp/entity_extractor.py
import spacy
import re
from datetime import datetime, timedelta

class EntityExtractor:
    def __init__(self):
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except:
            print("Warning: Spacy model not found. Run: python -m spacy download en_core_web_sm")
            self.nlp = None
        
        self.categories = [
            'groceries', 'food', 'transport', 'transportation', 'entertainment',
            'utilities', 'rent', 'healthcare', 'health', 'shopping', 'clothes',
            'education', 'income', 'salary', 'savings', 'restaurant', 'gas',
            'electric', 'water', 'internet', 'phone', 'gym', 'fitness'
        ]
    
    def extract_amount(self, text):
        """Extract money amounts like $50, 50 dollars, etc."""
        patterns = [
            r'\$(\d+\.?\d*)',
            r'(\d+\.?\d*)\s*dollars?',
            r'(\d+\.?\d*)\s*bucks?',
            r'(\d+\.?\d*)\s*usd',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text.lower())
            if match:
                return float(match.group(1))
        
        # Try to find any number
        match = re.search(r'(\d+\.?\d*)', text)
        if match:
            return float(match.group(1))
        
        return None
    
    def extract_category(self, text):
        """Extract category from text"""
        text_lower = text.lower()
        
        # Direct category mentions
        for category in self.categories:
            if category in text_lower:
                # Normalize similar categories
                if category in ['transportation', 'gas']:
                    return 'transport'
                elif category in ['restaurant']:
                    return 'food'
                elif category in ['clothes']:
                    return 'shopping'
                elif category in ['health', 'fitness', 'gym']:
                    return 'healthcare'
                elif category in ['electric', 'water', 'internet', 'phone']:
                    return 'utilities'
                elif category == 'salary':
                    return 'income'
                return category
        
        # Default category based on keywords
        if any(word in text_lower for word in ['ate', 'dinner', 'lunch', 'breakfast', 'meal']):
            return 'food'
        elif any(word in text_lower for word in ['movie', 'game', 'concert', 'show']):
            return 'entertainment'
        elif any(word in text_lower for word in ['uber', 'lyft', 'taxi', 'bus', 'train']):
            return 'transport'
        
        return 'other'
    
    def extract_date(self, text):
        """Extract dates like 'yesterday', 'last week', etc."""
        text_lower = text.lower()
        
        if 'yesterday' in text_lower:
            return datetime.now() - timedelta(days=1)
        elif 'today' in text_lower or 'this morning' in text_lower:
            return datetime.now()
        elif 'last week' in text_lower:
            return datetime.now() - timedelta(weeks=1)
        elif 'last month' in text_lower:
            return datetime.now() - timedelta(days=30)
        
        # Try to extract with spacy
        if self.nlp:
            doc = self.nlp(text)
            for ent in doc.ents:
                if ent.label_ == "DATE":
                    return self.parse_relative_date(ent.text)
        
        return datetime.now()
    
    def parse_relative_date(self, date_str):
        """Parse relative date strings"""
        date_str_lower = date_str.lower()
        
        days_of_week = {
            'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
            'friday': 4, 'saturday': 5, 'sunday': 6
        }
        
        for day, num in days_of_week.items():
            if day in date_str_lower:
                today = datetime.now()
                days_ahead = num - today.weekday()
                if days_ahead > 0:
                    days_ahead -= 7
                return today + timedelta(days=days_ahead)
        
        return datetime.now()
    
    def extract_all(self, text):
        """Extract all entities from text"""
        return {
            'amount': self.extract_amount(text),
            'category': self.extract_category(text),
            'date': self.extract_date(text),
            'description': text[:200]  # Limit description length
        }