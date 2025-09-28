import json
from datetime import datetime
from supabase import create_client, Client

# Your Supabase credentials
SUPABASE_URL = "https://wkrpdhptbnnagrxxhxxj.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrcnBkaHB0Ym5uYWdyeHhoeHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMzMxOTQsImV4cCI6MjA3NDYwOTE5NH0._8kAOFimL5bM0nBmTMynFjpnJvNuEnlm5KBA5N0AjvE"

def upload_menu_data():
    """Upload menu data from JSON to Supabase"""
    
    # Initialize Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Load the scraped data
    with open('menu_data.json', 'r') as f:
        data = json.load(f)
    
    print(f"🚀 Starting upload of {len(data['halls'])} dining halls...")
    
    # Clear existing food items (for fresh data each day)
    today = datetime.now().strftime('%Y-%m-%d')
    print(f"📅 Clearing old data for {today}...")
    
    try:
        supabase.table('food_items').delete().eq('available_date', today).execute()
        print("✅ Cleared old food items")
    except Exception as e:
        print(f"⚠️ Note: {e}")
    
    # Upload each dining hall's data
    for hall_name, hall_data in data['halls'].items():
        print(f"\n📍 Uploading {hall_name}...")
        
        for station_name, items in hall_data['stations'].items():
            print(f"  📋 Station: {station_name} ({len(items)} items)")
            
            for item in items:
                # Prepare the food item for database
                food_item = {
                    'name': item['name'],
                    'station': station_name,
                    'dining_hall': hall_name,
                    'available_date': today,
                    'tags': item.get('dietary_tags', []),
                    'allergens': item.get('allergens', [])
                }
                
                # Add nutrition data if available
                nutrition = item.get('nutrition', {})
                if nutrition.get('has_nutrition_data'):
                    food_item.update({
                        'calories': nutrition.get('calories', 0),
                        'protein': nutrition.get('protein_g', 0),
                        'carbs': nutrition.get('total_carbs_g', 0),
                        'fat': nutrition.get('total_fat_g', 0)
                    })
                
                # Upload to Supabase
                try:
                    supabase.table('food_items').insert(food_item).execute()
                    print(f"    ✅ {item['name']}")
                except Exception as e:
                    print(f"    ❌ Failed: {item['name']} - {e}")
    
    print(f"\n🎉 Upload complete!")
    print(f"📊 Uploaded data from {len(data['halls'])} dining halls")
    print(f"📅 Data available for: {today}")

if __name__ == "__main__":
    upload_menu_data()