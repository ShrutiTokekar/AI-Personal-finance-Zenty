# backend/src/services/stock_service.py
import yfinance as yf
from datetime import datetime
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

class StockService:
    """Service for fetching real-time stock data"""
    
    @staticmethod
    def get_stock_info(symbol: str) -> Optional[Dict]:
        """Get current stock information"""
        try:
            print(f"Fetching stock info for: {symbol}")
            
            stock = yf.Ticker(symbol)
            info = stock.info
            
            # Check if we got valid data
            if not info or 'symbol' not in info:
                logger.warning(f"No data found for symbol: {symbol}")
                return None
            
            # Get current price - try multiple fields
            current_price = (
                info.get('currentPrice') or 
                info.get('regularMarketPrice') or 
                info.get('previousClose')
            )
            
            previous_close = info.get('previousClose')
            
            if not current_price:
                logger.warning(f"No price data available for {symbol}")
                return None
            
            if not previous_close:
                previous_close = current_price
            
            price_change = current_price - previous_close
            price_change_percent = (price_change / previous_close) * 100 if previous_close > 0 else 0
            
            result = {
                'symbol': symbol,
                'name': info.get('longName') or info.get('shortName') or symbol,
                'current_price': float(current_price),
                'previous_close': float(previous_close),
                'price_change': float(price_change),
                'price_change_percent': float(price_change_percent),
                'day_high': float(info.get('dayHigh', 0)) if info.get('dayHigh') else None,
                'day_low': float(info.get('dayLow', 0)) if info.get('dayLow') else None,
                'volume': int(info.get('volume', 0)) if info.get('volume') else None,
                'market_cap': int(info.get('marketCap', 0)) if info.get('marketCap') else None,
                'pe_ratio': float(info.get('trailingPE', 0)) if info.get('trailingPE') else None,
                'fifty_two_week_high': float(info.get('fiftyTwoWeekHigh', 0)) if info.get('fiftyTwoWeekHigh') else None,
                'fifty_two_week_low': float(info.get('fiftyTwoWeekLow', 0)) if info.get('fiftyTwoWeekLow') else None,
                'currency': info.get('currency', 'USD'),
                'exchange': info.get('exchange'),
                'last_updated': datetime.now().isoformat()
            }
            
            print(f"Successfully fetched data for {symbol}")
            return result
            
        except Exception as e:
            logger.error(f"Error fetching stock data for {symbol}: {str(e)}")
            print(f"Exception details: {type(e).__name__}: {str(e)}")
            return None
    
    @staticmethod
    def get_multiple_stocks(symbols: List[str]) -> Dict[str, Optional[Dict]]:
        """Get information for multiple stocks"""
        results = {}
        for symbol in symbols:
            results[symbol] = StockService.get_stock_info(symbol)
        return results
    
    @staticmethod
    def get_stock_history(symbol: str, period: str = "1mo") -> Optional[List[Dict]]:
        """
        Get historical stock data
        period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
        """
        try:
            stock = yf.Ticker(symbol)
            hist = stock.history(period=period)
            
            if hist.empty:
                return None
            
            history = []
            for date, row in hist.iterrows():
                history.append({
                    'date': date.isoformat(),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume'])
                })
            
            return history
        except Exception as e:
            logger.error(f"Error fetching history for {symbol}: {e}")
            return None
    
    @staticmethod
    def search_stocks(query: str) -> List[Dict]:
        """Search for stocks by name or symbol"""
        try:
            ticker = yf.Ticker(query)
            info = ticker.info
            
            if info and info.get('symbol'):
                return [{
                    'symbol': info.get('symbol'),
                    'name': info.get('longName') or info.get('shortName'),
                    'exchange': info.get('exchange'),
                    'type': info.get('quoteType')
                }]
            return []
        except Exception as e:
            logger.error(f"Error searching for {query}: {e}")
            return []
    
    @staticmethod
    def validate_symbol(symbol: str) -> bool:
        """Check if a stock symbol is valid"""
        try:
            print(f"Validating symbol: {symbol}")
            
            stock = yf.Ticker(symbol)
            info = stock.info
            
            # Check multiple conditions for validity
            is_valid = (
                info and 
                'symbol' in info and 
                (info.get('regularMarketPrice') is not None or 
                 info.get('currentPrice') is not None or 
                 info.get('previousClose') is not None)
            )
            
            print(f"Symbol {symbol} validation result: {is_valid}")
            return is_valid
            
        except Exception as e:
            print(f"Validation error for {symbol}: {str(e)}")
            return False