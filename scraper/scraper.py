#!/usr/bin/env python3
"""
Improved MDining Scraper that handles real data accurately
Captures ALL menu items, not just those with complete nutrition data
"""

import requests
from bs4 import BeautifulSoup
import json
import re
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict
import time

@dataclass
class NutritionInfo:
    calories: Optional[int] = None
    total_fat_g: Optional[float] = None
    saturated_fat_g: Optional[float] = None
    cholesterol_mg: Optional[float] = None
    sodium_mg: Optional[float] = None
    total_carbs_g: Optional[float] = None
    fiber_g: Optional[float] = None
    sugars_g: Optional[float] = None
    protein_g: Optional[float] = None
    serving_size: Optional[str] = None
    has_nutrition_data: bool = False

@dataclass
class MenuItem:
    name: str
    station: str
    nutrition: NutritionInfo
    allergens: List[str]
    dietary_tags: List[str]
    hall_name: str

class ImprovedMDiningScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
    def extract_number(self, text: str) -> Optional[float]:
        """Extract first number from text, handling decimals"""
        if not text:
            return None
        # Look for number patterns like "18g", "254", "1.5g"
        match = re.search(r'(\d+(?:\.\d+)?)', str(text).strip())
        return float(match.group(1)) if match else None
    
    def parse_nutrition_robust(self, item_element) -> NutritionInfo:
        """Parse nutrition with better error handling"""
        nutrition = NutritionInfo()
        
        nutrition_div = item_element.find('div', class_='nutrition')
        if not nutrition_div:
            return nutrition
            
        table = nutrition_div.find('table', class_='nutrition-facts')
        if not table:
            return nutrition
        
        # Mark that we found nutrition data
        nutrition.has_nutrition_data = True
        
        try:
            # Get all table rows for easier parsing
            rows = table.find_all('tr')
            
            for row in rows:
                row_text = row.get_text(strip=True)
                row_classes = row.get('class', [])
                
                # Serving size
                if 'serving-size' in row_classes:
                    match = re.search(r'Serving Size\s+(.+)', row_text)
                    if match:
                        nutrition.serving_size = match.group(1).strip()
                
                # Calories
                elif 'portion-calories' in row_classes or 'Calories' in row_text:
                    nutrition.calories = self.extract_number(row_text)
                
                # Macronutrients - look for specific patterns
                elif 'Total Fat' in row_text and 'has-subitems' in row_classes:
                    nutrition.total_fat_g = self.extract_number(row_text)
                elif 'Saturated Fat' in row_text:
                    nutrition.saturated_fat_g = self.extract_number(row_text)
                elif 'Cholesterol' in row_text:
                    nutrition.cholesterol_mg = self.extract_number(row_text)
                elif 'Sodium' in row_text and 'micronutrient' not in row_classes:
                    nutrition.sodium_mg = self.extract_number(row_text)
                elif 'Total Carbohydrate' in row_text and 'has-subitems' in row_classes:
                    nutrition.total_carbs_g = self.extract_number(row_text)
                elif 'Dietary Fiber' in row_text:
                    nutrition.fiber_g = self.extract_number(row_text)
                elif 'Sugars' in row_text and 'Added' not in row_text:
                    nutrition.sugars_g = self.extract_number(row_text)
                elif 'Protein' in row_text and 'micronutrient' not in row_classes:
                    nutrition.protein_g = self.extract_number(row_text)
                    
        except Exception as e:
            print(f"Error parsing nutrition: {e}")
            
        return nutrition
    
    def extract_allergens_comprehensive(self, item_element) -> List[str]:
        """Extract allergens from multiple sources"""
        allergens = set()
        
        # From CSS classes
        classes = item_element.get('class', [])
        for cls in classes:
            if cls.startswith('allergen-'):
                allergen = cls.replace('allergen-', '').replace('_', ' ')
                allergens.add(allergen)
        
        # From allergens div
        nutrition_div = item_element.find('div', class_='nutrition')
        if nutrition_div:
            allergens_div = nutrition_div.find('div', class_='allergens')
            if allergens_div:
                allergen_items = allergens_div.find_all('li')
                for item in allergen_items:
                    allergen_text = item.get_text(strip=True)
                    if allergen_text:
                        allergens.add(allergen_text)
        
        return sorted(list(allergens))
    
    def extract_dietary_tags_comprehensive(self, item_element) -> List[str]:
        """Extract all dietary information"""
        tags = set()
        
        # From CSS classes
        classes = item_element.get('class', [])
        for cls in classes:
            if cls.startswith('trait-'):
                trait = cls.replace('trait-', '')
                
                # Map to readable names
                trait_mapping = {
                    'vegan': 'Vegan',
                    'vegetarian': 'Vegetarian',
                    'halal': 'Halal',
                    'kosher': 'Kosher',
                    'glutenfree': 'Gluten Free',
                    'spicy': 'Spicy',
                    'mhealthy1': 'Low Nutrient Density',
                    'mhealthy2': 'Low-Medium Nutrient Density', 
                    'mhealthy3': 'Medium Nutrient Density',
                    'mhealthy4': 'Medium-High Nutrient Density',
                    'mhealthy5': 'High Nutrient Density',
                    'carbonlow': 'Low Carbon Footprint',
                    'carbonmedium': 'Medium Carbon Footprint',
                    'carbonhigh': 'High Carbon Footprint'
                }
                
                readable_trait = trait_mapping.get(trait, trait.replace('_', ' ').title())
                tags.add(readable_trait)
        
        # From traits list in HTML
        traits_ul = item_element.find('ul', class_='traits')
        if traits_ul:
            trait_items = traits_ul.find_all('li')
            for trait_item in trait_items:
                trait_text = trait_item.get('title') or trait_item.get_text(strip=True)
                if trait_text:
                    tags.add(trait_text)
        
        return sorted(list(tags))
    
    def scrape_dining_hall_comprehensive(self, hall_url: str, hall_name: str) -> List[MenuItem]:
        """Comprehensive scraping that captures ALL menu items"""
        print(f"Scraping {hall_name}: {hall_url}")
        
        try:
            response = self.session.get(hall_url, timeout=15)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"Error fetching {hall_url}: {e}")
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        menu_items = []
        
        # Find the main menu container
        menu_container = soup.find('div', id='mdining-menu')
        if not menu_container:
            print(f"No menu container found for {hall_name}")
            return []
        
        current_station = "General"
        
        # Process all elements in order to maintain station context
        for element in menu_container.find_all(['h4', 'li']):
            
            # Station headers
            if element.name == 'h4':
                station_text = element.get_text(strip=True)
                if station_text:
                    current_station = station_text
                continue
            
            # Menu items - cast wider net
            if element.name == 'li':
                # Look for item name
                name_div = element.find('div', class_='item-name')
                if not name_div:
                    continue
                
                item_name = name_div.get_text(strip=True)
                if not item_name or len(item_name) < 2:
                    continue
                
                # Skip if it's clearly not a food item
                skip_items = ['menu', 'header', 'station', 'title']
                if any(skip in item_name.lower() for skip in skip_items):
                    continue
                
                # Parse all available data
                nutrition = self.parse_nutrition_robust(element)
                allergens = self.extract_allergens_comprehensive(element)
                dietary_tags = self.extract_dietary_tags_comprehensive(element)
                
                # Create menu item
                menu_item = MenuItem(
                    name=item_name,
                    station=current_station,
                    nutrition=nutrition,
                    allergens=allergens,
                    dietary_tags=dietary_tags,
                    hall_name=hall_name
                )
                
                menu_items.append(menu_item)
                
                # Show what we found
                nutrition_status = "✓" if nutrition.has_nutrition_data else "○"
                print(f"  {nutrition_status} {item_name} ({current_station})")
        
        print(f"Found {len(menu_items)} items from {hall_name}")
        return menu_items
    
    def scrape_multiple_halls(self) -> Dict[str, List[MenuItem]]:
        """Scrape multiple dining halls"""
        halls = {
            'Bursley': 'https://dining.umich.edu/menus-locations/dining-halls/bursley/',
            'South Quad': 'https://dining.umich.edu/menus-locations/dining-halls/south-quad/',
            'East Quad': 'https://dining.umich.edu/menus-locations/dining-halls/east-quad/',
            'North Quad': 'https://dining.umich.edu/menus-locations/dining-halls/north-quad/',
            'Mosher-Jordan': 'https://dining.umich.edu/menus-locations/dining-halls/mosher-jordan/',
        }
        
        all_menus = {}
        for hall_name, hall_url in halls.items():
            try:
                menu_items = self.scrape_dining_hall_comprehensive(hall_url, hall_name)
                all_menus[hall_name] = menu_items
                
                # Small delay between requests
                time.sleep(1)
                
            except Exception as e:
                print(f"Failed to scrape {hall_name}: {e}")
                all_menus[hall_name] = []
        
        return all_menus
    
    def save_for_mobile_app(self, menus: Dict[str, List[MenuItem]], filename: str = 'menu_data.json'):
        """Save in format optimized for mobile app consumption"""
        
        # Convert to mobile-friendly format
        mobile_data = {
            'last_updated': time.strftime('%Y-%m-%d %H:%M:%S'),
            'halls': {}
        }
        
        total_items = 0
        items_with_nutrition = 0
        
        for hall_name, items in menus.items():
            hall_data = {
                'name': hall_name,
                'stations': {},
                'item_count': len(items),
                'items_with_nutrition': sum(1 for item in items if item.nutrition.has_nutrition_data)
            }
            
            # Group by station
            for item in items:
                station_name = item.station
                if station_name not in hall_data['stations']:
                    hall_data['stations'][station_name] = []
                
                # Convert to dict for JSON serialization
                item_data = {
                    'name': item.name,
                    'nutrition': asdict(item.nutrition),
                    'allergens': item.allergens,
                    'dietary_tags': item.dietary_tags
                }
                
                hall_data['stations'][station_name].append(item_data)
            
            mobile_data['halls'][hall_name] = hall_data
            total_items += len(items)
            items_with_nutrition += hall_data['items_with_nutrition']
        
        # Add summary stats
        mobile_data['summary'] = {
            'total_halls': len(menus),
            'total_items': total_items,
            'items_with_nutrition': items_with_nutrition,
            'nutrition_coverage': f"{items_with_nutrition}/{total_items} ({round(items_with_nutrition/total_items*100) if total_items > 0 else 0}%)"
        }
        
        # Save to file
        with open(filename, 'w') as f:
            json.dump(mobile_data, f, indent=2)
        
        print(f"\n📱 Mobile app data saved to {filename}")
        print(f"📊 Summary: {mobile_data['summary']['nutrition_coverage']} items have nutrition data")
        
        return mobile_data

def main():
    """Run the improved scraper"""
    print("🍽️ Starting improved MDining scraper...")
    
    scraper = ImprovedMDiningScraper()
    
    # Scrape all dining halls
    all_menus = scraper.scrape_multiple_halls()
    
    # Save for mobile app
    mobile_data = scraper.save_for_mobile_app(all_menus)
    
    print(f"\n✅ Scraping complete!")
    print(f"✅ Found {mobile_data['summary']['total_items']} total menu items")
    print(f"✅ {mobile_data['summary']['nutrition_coverage']} have detailed nutrition data")
    print(f"✅ Ready for mobile app integration")

if __name__ == "__main__":
    main()