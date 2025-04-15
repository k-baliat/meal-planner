import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv
import os
import requests
import random
import string

def get_real_chat_id():
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    url = f"https://api.telegram.org/bot{bot_token}/getUpdates"
    response = requests.get(url).json()
    try:
        return response["result"][-1]["message"]["chat"]["id"]
    except (KeyError, IndexError):
        raise Exception("❌ No chat ID found. Make sure you've messaged your bot.")


def send_telegram_message(message):
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    chat_id = get_real_chat_id()
    print(f'[APP]\t Chat ID: {chat_id}')
    data = {
        "chat_id": chat_id,
        "text": message
    }
    response = requests.post(url, data=data)
    print("[APP]\t ✅Successfully Sent Notification to the BOT!")
    return response.json()
