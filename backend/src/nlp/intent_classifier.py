# backend/src/nlp/intent_classifier.py
from transformers import pipeline
import torch

class IntentClassifier:
    def __init__(self):
        # Use zero-shot classification for intent detection
        try:
            self.classifier = pipeline(
                "zero-shot-classification", 
                model="facebook/bart-large-mnli",
                device=0 if torch.cuda.is_available() else -1
            )
        except Exception as e:
            print(f"Warning: Could not load transformer model: {e}")
            self.classifier = None
        
        self.intents = [
            "add_expense",
            "add_income", 
            "check_balance",
            "view_spending",
            "set_budget",
            "get_advice",
            "predict_spending",
            "find_savings",
            "show_transactions"
        ]
    
    def classify(self, text):
        """Classify user intent from natural language"""
        if self.classifier is None:
            # Fallback to keyword matching
            return self._keyword_fallback(text)
        
        try:
            result = self.classifier(text, self.intents)
            return {
                'intent': result['labels'][0],
                'confidence': result['scores'][0]
            }
        except Exception as e:
            print(f"Classification error: {e}")
            return self._keyword_fallback(text)
    
    def _keyword_fallback(self, text):
        """Simple keyword-based intent detection as fallback"""
        text_lower = text.lower()
        
        if any(word in text_lower for word in ['spent', 'paid', 'bought', 'cost']):
            return {'intent': 'add_expense', 'confidence': 0.8}
        elif any(word in text_lower for word in ['earned', 'received', 'income', 'salary']):
            return {'intent': 'add_income', 'confidence': 0.8}
        elif any(word in text_lower for word in ['show', 'list', 'view', 'see']):
            return {'intent': 'show_transactions', 'confidence': 0.7}
        elif any(word in text_lower for word in ['budget', 'limit', 'set']):
            return {'intent': 'set_budget', 'confidence': 0.7}
        elif any(word in text_lower for word in ['advice', 'suggest', 'help', 'recommend']):
            return {'intent': 'get_advice', 'confidence': 0.7}
        elif any(word in text_lower for word in ['predict', 'forecast', 'future']):
            return {'intent': 'predict_spending', 'confidence': 0.7}
        else:
            return {'intent': 'view_spending', 'confidence': 0.5}