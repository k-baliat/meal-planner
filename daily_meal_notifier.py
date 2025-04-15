import os
import schedule
import time
import json
import base64
from datetime import datetime, timedelta
from public.utils.text_utils import send_telegram_message
import firebase_admin
from firebase_admin import credentials, initialize_app, firestore
from dotenv import load_dotenv

# Decode base64-encoded JSON from env var
#Ran the following in terminal and added the result in .env: base64 -i FirebaseConfig.json 
load_dotenv()
service_account_info = json.loads(
    base64.b64decode(os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64"))
)

# Initialize Firebase
cred = credentials.Certificate(service_account_info)
print(cred)
initialize_app(cred)
db = firestore.client()

def get_today_meal():
    """
    Get today's meal information from Firestore
    Returns a formatted string with the meal details
    """
    try:
        # Get today's date and day of week
        today = datetime.now()
        day_of_week = today.strftime('%A')
        date_str = today.strftime('%B %d, %Y')
        
        # Get the week range
        week_range = get_week_range(today)
        
        # Get meal plan for this week
        meal_plan_ref = db.collection('mealPlans').document(week_range)
        meal_plan = meal_plan_ref.get()
        
        if not meal_plan.exists:
            return f"No meal planned for {day_of_week}, {date_str}"
            
        meal_data = meal_plan.to_dict()
        recipe_ids = meal_data.get(day_of_week, '').split(',')
        
        if not recipe_ids or recipe_ids[0] == '':
            return f"No meal planned for {day_of_week}, {date_str}"
            
        # Get recipe details
        message = f"🍽️ Today's Meal ({day_of_week}, {date_str}):\n\n"
        
        for recipe_id in recipe_ids:
            recipe_ref = db.collection('recipes').document(recipe_id)
            recipe = recipe_ref.get()
            
            if recipe.exists:
                recipe_data = recipe.to_dict()
                message += f"📌 {recipe_data['name']}\n"
                message += "Ingredients:\n"
                for ingredient in recipe_data['ingredients']:
                    message += f"• {ingredient}\n"
                message += "\n"
        
        return message.strip()
    except Exception as e:
        return f"Error getting meal information: {str(e)}"


def get_week_range(date):
    """
    Get the week range string for a given date
    """
    start_of_week = date - timedelta(days=date.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    return f"{start_of_week.strftime('%B %d, %Y')} - {end_of_week.strftime('%B %d, %Y')}"


def send_daily_meal():
    """
    Send today's meal information via Telegram
    """
    message = get_today_meal()
    send_telegram_message(message)

def main():
    # Schedule the job to run at 12 PM every day
    schedule.every().day.at("12:00").do(send_daily_meal)
    
    # Run the scheduler
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    main() 