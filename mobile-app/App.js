// App.js - Main React Native App
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  RefreshControl,
  Modal
} from 'react-native';

import realMenuData from './menu_data.json';



/* Mock data for demo - in real app this would come from your scraped JSON
const mockMenuData = {
  "last_updated": "2025-09-27 20:30:00",
  "halls": {
    "Bursley": {
      "name": "Bursley",
      "stations": {
        "Grill": [
          {
            "name": "Grilled Chicken Breast",
            "nutrition": {
              "calories": 284,
              "protein_g": 53.4,
              "total_carbs_g": 0,
              "total_fat_g": 6.2,
              "fiber_g": 0,
              "sodium_mg": 320,
              "has_nutrition_data": true,
              "serving_size": "6 oz (170g)"
            },
            "allergens": [],
            "dietary_tags": ["High Protein", "Low Carbon Footprint"]
          },
          {
            "name": "Turkey Burger",
            "nutrition": {
              "calories": 390,
              "protein_g": 28,
              "total_carbs_g": 32,
              "total_fat_g": 18,
              "fiber_g": 3,
              "sodium_mg": 680,
              "has_nutrition_data": true,
              "serving_size": "1 burger (180g)"
            },
            "allergens": ["wheat/barley/rye"],
            "dietary_tags": ["High Protein"]
          }
        ],
        "Wild Fire Maize": [
          {
            "name": "Stew Beef Poutine",
            "nutrition": {
              "calories": 338,
              "protein_g": 9,
              "total_carbs_g": 11,
              "total_fat_g": 29,
              "fiber_g": 1,
              "sodium_mg": 237,
              "has_nutrition_data": true,
              "serving_size": "1/2 Cup (105g)"
            },
            "allergens": ["beef", "milk"],
            "dietary_tags": ["Halal", "High Carbon Footprint"]
          },
          {
            "name": "Criss Cross Fries",
            "nutrition": {
              "calories": 272,
              "protein_g": 1,
              "total_carbs_g": 23,
              "total_fat_g": 20,
              "fiber_g": 1,
              "sodium_mg": 27,
              "has_nutrition_data": true,
              "serving_size": "1/2 Cup (113g)"
            },
            "allergens": ["item is deep fried"],
            "dietary_tags": ["Vegan", "Low Carbon Footprint"]
          }
        ],
        "MBakery": [
          {
            "name": "Red Velvet Cake",
            "nutrition": {
              "calories": 359,
              "protein_g": 4,
              "total_carbs_g": 46,
              "total_fat_g": 18,
              "fiber_g": 1,
              "sodium_mg": 394,
              "has_nutrition_data": true,
              "serving_size": "Slice (94g)"
            },
            "allergens": ["eggs", "milk", "soy", "wheat/barley/rye"],
            "dietary_tags": ["Vegetarian", "Medium Carbon Footprint"]
          }
        ]
      },
      "item_count": 5,
      "items_with_nutrition": 5
    },
    "South Quad": {
      "name": "South Quad", 
      "stations": {
        "Global Kitchen": [
          {
            "name": "Chicken Tikka Masala",
            "nutrition": {
              "calories": 420,
              "protein_g": 35,
              "total_carbs_g": 12,
              "total_fat_g": 26,
              "fiber_g": 2,
              "sodium_mg": 890,
              "has_nutrition_data": true,
              "serving_size": "1 cup (240g)"
            },
            "allergens": ["milk"],
            "dietary_tags": ["Spicy", "High Protein", "Halal"]
          }
        ],
        "Pizza Station": [
          {
            "name": "Cheese Pizza",
            "nutrition": {
              "calories": 285,
              "protein_g": 12,
              "total_carbs_g": 36,
              "total_fat_g": 10,
              "fiber_g": 2,
              "sodium_mg": 640,
              "has_nutrition_data": true,
              "serving_size": "1 slice (107g)"
            },
            "allergens": ["milk", "wheat/barley/rye"],
            "dietary_tags": ["Vegetarian"]
          }
        ]
      },
      "item_count": 2,
      "items_with_nutrition": 2
    }
  },
  "summary": {
    "total_halls": 2,
    "total_items": 7,
    "items_with_nutrition": 7,
    "nutrition_coverage": "7/7 (100%)"
  }
};

*/

// Components
const MacroCard = ({ label, value, unit, color = '#007AFF' }) => (
  <View style={[styles.macroCard, { borderTopColor: color }]}>
    <Text style={[styles.macroValue, { color }]}>{value || 0}{unit}</Text>
    <Text style={styles.macroLabel}>{label}</Text>
  </View>
);

const FoodItem = ({ item, onPress, isSelected }) => (
  <TouchableOpacity 
    style={[styles.foodItem, isSelected && styles.selectedFoodItem]} 
    onPress={() => onPress(item)}
  >
    <View style={styles.foodHeader}>
      <Text style={styles.foodName}>{item.name}</Text>
      {item.nutrition.has_nutrition_data && (
        <Text style={styles.caloriesBadge}>{item.nutrition.calories} cal</Text>
      )}
    </View>
    
    <View style={styles.tagsContainer}>
      {item.dietary_tags.slice(0, 3).map((tag, index) => (
        <View key={index} style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ))}
    </View>
    
    {item.allergens.length > 0 && (
      <Text style={styles.allergenText}>
        ⚠️ Contains: {item.allergens.slice(0, 2).join(', ')}
        {item.allergens.length > 2 && ` +${item.allergens.length - 2} more`}
      </Text>
    )}
    
    {item.nutrition.has_nutrition_data && (
      <View style={styles.macroPreview}>
        <Text style={styles.macroPreviewText}>
          P: {item.nutrition.protein_g}g • C: {item.nutrition.total_carbs_g}g • F: {item.nutrition.total_fat_g}g
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

const GoalInput = ({ label, value, onChangeText, unit }) => (
  <View style={styles.goalInput}>
    <Text style={styles.goalLabel}>{label}</Text>
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.goalTextInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="0"
        keyboardType="numeric"
      />
      <Text style={styles.unitLabel}>{unit}</Text>
    </View>
  </View>
);

// Main App Component
export default function App() {
  const [currentTab, setCurrentTab] = useState('menu');
  const [selectedHall, setSelectedHall] = useState('Bursley');
  const [selectedItems, setSelectedItems] = useState([]);
  const [userGoals, setUserGoals] = useState({
    calories: '2000',
    protein: '150',
    carbs: '250',
    fat: '65'
  });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [menuData, setMenuData] = useState(realMenuData);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate totals from selected items
  const calculateTotals = () => {
    return selectedItems.reduce((totals, item) => {
      if (item.nutrition.has_nutrition_data) {
        totals.calories += item.nutrition.calories || 0;
        totals.protein += item.nutrition.protein_g || 0;
        totals.carbs += item.nutrition.total_carbs_g || 0;
        totals.fat += item.nutrition.total_fat_g || 0;
        totals.fiber += item.nutrition.fiber_g || 0;
        totals.sodium += item.nutrition.sodium_mg || 0;
      }
      return totals;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 });
  };

  const totals = calculateTotals();

  const toggleFoodItem = (item) => {
    const isSelected = selectedItems.some(selected => 
      selected.name === item.name && selected.station === item.station
    );
    
    if (isSelected) {
      setSelectedItems(prev => prev.filter(selected => 
        !(selected.name === item.name && selected.station === item.station)
      ));
    } else {
      setSelectedItems(prev => [...prev, item]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate refreshing data
    setTimeout(() => {
      setRefreshing(false);
      Alert.alert('Updated', 'Menu data refreshed successfully!');
    }, 1000);
  };

  const calculateGoalProgress = (current, goal) => {
    const percentage = (current / parseFloat(goal)) * 100;
    return Math.min(percentage, 100);
  };

  // Render different tabs
  const renderMenuTab = () => {
    const hallData = menuData.halls[selectedHall];
    if (!hallData) return <Text>No data available</Text>;

    return (
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hall Selector */}
        <View style={styles.hallSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.keys(menuData.halls).map(hallName => (
              <TouchableOpacity
                key={hallName}
                style={[styles.hallButton, selectedHall === hallName && styles.selectedHallButton]}
                onPress={() => setSelectedHall(hallName)}
              >
                <Text style={[styles.hallButtonText, selectedHall === hallName && styles.selectedHallButtonText]}>
                  {hallName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Selected Items Summary */}
        {selectedItems.length > 0 && (
          <View style={styles.selectedSummary}>
            <Text style={styles.selectedTitle}>Selected Items ({selectedItems.length})</Text>
            <View style={styles.macroRow}>
              <MacroCard label="Calories" value={Math.round(totals.calories)} unit="" color="#FF6B6B" />
              <MacroCard label="Protein" value={Math.round(totals.protein)} unit="g" color="#4ECDC4" />
              <MacroCard label="Carbs" value={Math.round(totals.carbs)} unit="g" color="#45B7D1" />
              <MacroCard label="Fat" value={Math.round(totals.fat)} unit="g" color="#FFA07A" />
            </View>
          </View>
        )}

        {/* Menu Items by Station */}
        {Object.entries(hallData.stations).map(([stationName, items]) => (
          <View key={stationName} style={styles.stationSection}>
            <Text style={styles.stationHeader}>{stationName}</Text>
            {items.map((item, index) => (
              <FoodItem
                key={`${stationName}-${index}`}
                item={item}
                onPress={toggleFoodItem}
                isSelected={selectedItems.some(selected => 
                  selected.name === item.name && selected.station === stationName
                )}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderTrackingTab = () => (
    <ScrollView style={styles.container}>
      <View style={styles.trackingHeader}>
        <Text style={styles.trackingTitle}>Daily Progress</Text>
        <TouchableOpacity style={styles.goalButton} onPress={() => setShowGoalModal(true)}>
          <Text style={styles.goalButtonText}>Edit Goals</Text>
        </TouchableOpacity>
      </View>

      {/* Macro Progress */}
      <View style={styles.progressSection}>
        {[
          { label: 'Calories', current: totals.calories, goal: userGoals.calories, color: '#FF6B6B', unit: '' },
          { label: 'Protein', current: totals.protein, goal: userGoals.protein, color: '#4ECDC4', unit: 'g' },
          { label: 'Carbs', current: totals.carbs, goal: userGoals.carbs, color: '#45B7D1', unit: 'g' },
          { label: 'Fat', current: totals.fat, goal: userGoals.fat, color: '#FFA07A', unit: 'g' }
        ].map((macro, index) => {
          const progress = calculateGoalProgress(macro.current, macro.goal);
          return (
            <View key={index} style={styles.progressItem}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>{macro.label}</Text>
                <Text style={styles.progressText}>
                  {Math.round(macro.current)}{macro.unit} / {macro.goal}{macro.unit}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { 
                    width: `${progress}%`, 
                    backgroundColor: macro.color 
                  }]} 
                />
              </View>
              <Text style={styles.progressPercentage}>{Math.round(progress)}%</Text>
            </View>
          );
        })}
      </View>

      {/* Selected Items List */}
      {selectedItems.length > 0 && (
        <View style={styles.selectedItemsList}>
          <Text style={styles.sectionTitle}>Today's Meals</Text>
          {selectedItems.map((item, index) => (
            <View key={index} style={styles.selectedItemRow}>
              <View style={styles.selectedItemInfo}>
                <Text style={styles.selectedItemName}>{item.name}</Text>
                <Text style={styles.selectedItemStation}>{item.station}</Text>
              </View>
              <TouchableOpacity onPress={() => toggleFoodItem(item)}>
                <Text style={styles.removeButton}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>UMacros</Text>
        <Text style={styles.headerSubtitle}>UM Dining Tracker</Text>
      </View>

      {/* Tab Content */}
      {currentTab === 'menu' ? renderMenuTab() : renderTrackingTab()}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navButton, currentTab === 'menu' && styles.activeNavButton]}
          onPress={() => setCurrentTab('menu')}
        >
          <Text style={[styles.navButtonText, currentTab === 'menu' && styles.activeNavButtonText]}>
            Menu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navButton, currentTab === 'tracking' && styles.activeNavButton]}
          onPress={() => setCurrentTab('tracking')}
        >
          <Text style={[styles.navButtonText, currentTab === 'tracking' && styles.activeNavButtonText]}>
            Progress
          </Text>
        </TouchableOpacity>
      </View>

      {/* Goal Setting Modal */}
      <Modal visible={showGoalModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Daily Goals</Text>
            
            <GoalInput 
              label="Calories" 
              value={userGoals.calories} 
              onChangeText={(text) => setUserGoals(prev => ({...prev, calories: text}))}
              unit="cal"
            />
            <GoalInput 
              label="Protein" 
              value={userGoals.protein} 
              onChangeText={(text) => setUserGoals(prev => ({...prev, protein: text}))}
              unit="g"
            />
            <GoalInput 
              label="Carbs" 
              value={userGoals.carbs} 
              onChangeText={(text) => setUserGoals(prev => ({...prev, carbs: text}))}
              unit="g"
            />
            <GoalInput 
              label="Fat" 
              value={userGoals.fat} 
              onChangeText={(text) => setUserGoals(prev => ({...prev, fat: text}))}
              unit="g"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowGoalModal(false)}>
                <Text style={styles.modalButtonText}>Save Goals</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowGoalModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  hallSelector: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  hallButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
  },
  selectedHallButton: {
    backgroundColor: '#007AFF',
  },
  hallButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  selectedHallButtonText: {
    color: '#fff',
  },
  selectedSummary: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#212529',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 3,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderTopWidth: 3,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  macroLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  stationSection: {
    margin: 15,
    marginTop: 0,
  },
  stationHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  foodItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedFoodItem: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
  },
  caloriesBadge: {
    backgroundColor: '#007AFF',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tag: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  allergenText: {
    fontSize: 12,
    color: '#dc3545',
    marginBottom: 8,
  },
  macroPreview: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  macroPreviewText: {
    fontSize: 13,
    color: '#6c757d',
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  trackingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  goalButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  goalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressSection: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressItem: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  progressText: {
    fontSize: 14,
    color: '#6c757d',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'right',
  },
  selectedItemsList: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#212529',
  },
  selectedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
  },
  selectedItemStation: {
    fontSize: 12,
    color: '#6c757d',
  },
  removeButton: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingBottom: 10,
  },
  navButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeNavButton: {
    borderTopWidth: 3,
    borderTopColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  activeNavButtonText: {
    color: '#007AFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 25,
    borderRadius: 15,
    width: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#212529',
  },
  goalInput: {
    marginBottom: 15,
  },
  goalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#212529',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  goalTextInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  unitLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    flex: 0.45,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});