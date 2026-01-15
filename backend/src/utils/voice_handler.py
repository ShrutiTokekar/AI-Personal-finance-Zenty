# src/utils/voice_handler.py
import speech_recognition as sr

class VoiceHandler:
    def __init__(self):
        self.recognizer = sr.Recognizer()
    
    def listen(self):
        """Convert speech to text"""
        with sr.Microphone() as source:
            print("🎤 Listening...")
            audio = self.recognizer.listen(source)
            
        try:
            text = self.recognizer.recognize_google(audio)
            return text
        except sr.UnknownValueError:
            return "Sorry, I couldn't understand that."