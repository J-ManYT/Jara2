import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Alert, 
  ActivityIndicator,
  RefreshControl,
  Image 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';

export default function App() {
  // Authentication state
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation state
  const [currentScreen, setCurrentScreen] = useState('halls'); // 'halls', 'meals', 'food', 'progress'
  const [selectedHall, setSelectedHall] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState(null);
  
  // Data state
  const [selectedItems, setSelectedItems] = useState([]);
  const [userGoals, setUserGoals] = useState({
    calories: '2000',
    protein: '150', 
    carbs: '250',
    fat: '65'
  });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });
  const [availableHalls, setAvailableHalls] = useState([]);
  const [foodItems, setFoodItems] = useState([]);

  // Initialize Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user data when authenticated
  useEffect(() => {
    if (session) {
      loadUserData();
      loadAvailableHalls();
    }
  }, [session]);

  const loadUserData = async () => {
    try {
      // Load user goals
      const { data: goals, error: goalsError } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (goals && !goalsError) {
        setUserGoals({
          calories: goals.calories.toString(),
          protein: goals.protein.toString(),
          carbs: goals.carbs.toString(),
          fat: goals.fat.toString(),
        });
      } else if (goalsError && goalsError.code === 'PGRST116') {
        await createDefaultGoals();
      }

      await loadTodaysSelections();
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const createDefaultGoals = async () => {
    try {
      const { error } = await supabase
        .from('user_goals')
        .insert({
          user_id: session.user.id,
          calories: 2000,
          protein: 150,
          carbs: 250,
          fat: 65,
        });
      
      if (error) {
        console.error('Error creating default goals:', error);
      }
    } catch (error) {
      console.error('Error creating default goals:', error);
    }
  };

  const loadTodaysSelections = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: selections, error: selectionsError } = await supabase
        .from('user_food_selections')
        .select(`
          *,
          food_items (*)
        `)
        .eq('user_id', session.user.id)
        .eq('selected_date', today);

      if (selections && !selectionsError) {
        const items = selections.map(selection => ({
          ...selection.food_items,
          quantity: selection.quantity,
          selection_id: selection.id
        }));
        setSelectedItems(items);
      }
    } catch (error) {
      console.error('Error loading selections:', error);
    }
  };

  const loadAvailableHalls = async () => {
  // Hardcode the halls we know exist
  setAvailableHalls([
    'Bursley',
    'South Quad', 
    'East Quad',
    'North Quad',
    'Mosher-Jordan',
    'Markley',
    'Twigs at Oxford'
  ]);
};

  const loadFoodForMeal = async (hall, mealTime) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('food_items')
        .select('*')
        .eq('available_date', today)
        .eq('dining_hall', hall);

      if (mealTime !== 'all-day') {
        query = query.or(`meal_time.eq.${mealTime},meal_time.eq.all-day`);
      }

      const { data: items, error } = await query;

      if (items && !error) {
        setFoodItems(items);
      }
    } catch (error) {
      console.error('Error loading food items:', error);
    }
  };

  const updateFoodQuantity = async (item, newQuantity) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (newQuantity <= 0) {
        // Remove item
        const existingSelection = selectedItems.find(s => s.id === item.id);
        if (existingSelection) {
          await supabase
            .from('user_food_selections')
            .delete()
            .eq('id', existingSelection.selection_id);
          
          setSelectedItems(prev => prev.filter(s => s.id !== item.id));
        }
      } else {
        // Update or add item
        const existingSelection = selectedItems.find(s => s.id === item.id);
        
        if (existingSelection) {
          // Update existing
          await supabase
            .from('user_food_selections')
            .update({ quantity: newQuantity })
            .eq('id', existingSelection.selection_id);
          
          setSelectedItems(prev => 
            prev.map(s => s.id === item.id ? { ...s, quantity: newQuantity } : s)
          );
        } else {
          // Add new
          const { data: newSelection, error } = await supabase
            .from('user_food_selections')
            .insert({
              user_id: session.user.id,
              food_item_id: item.id,
              selected_date: today,
              quantity: newQuantity
            })
            .select()
            .single();

          if (newSelection && !error) {
            setSelectedItems(prev => [...prev, {
              ...item,
              quantity: newQuantity,
              selection_id: newSelection.id
            }]);
          }
        }
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update selection');
    }
  };

  const saveGoals = async () => {
    try {
      const { error } = await supabase
        .from('user_goals')
        .upsert({
          user_id: session.user.id,
          calories: parseInt(userGoals.calories),
          protein: parseInt(userGoals.protein),
          carbs: parseInt(userGoals.carbs),
          fat: parseInt(userGoals.fat),
        });

      if (!error) {
        setShowGoalModal(false);
        Alert.alert('Success', 'Goals updated!');
      }
    } catch (error) {
      console.error('Error saving goals:', error);
      Alert.alert('Error', 'Failed to save goals');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAvailableHalls();
    await loadTodaysSelections();
    if (selectedHall && selectedMeal) {
      await loadFoodForMeal(selectedHall, selectedMeal);
    }
    setRefreshing(false);
  };

  // Calculate totals
  useEffect(() => {
    const newTotals = selectedItems.reduce((acc, item) => ({
      calories: acc.calories + (item.calories * item.quantity || 0),
      protein: acc.protein + (item.protein * item.quantity || 0),
      carbs: acc.carbs + (item.carbs * item.quantity || 0),
      fat: acc.fat + (item.fat * item.quantity || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    setTotals(newTotals);
  }, [selectedItems]);

  const calculateGoalProgress = (current, goal) => {
    const percentage = (current / parseFloat(goal)) * 100;
    return Math.min(percentage, 100);
  };

  const getItemQuantity = (item) => {
    const selectedItem = selectedItems.find(s => s.id === item.id);
    return selectedItem ? selectedItem.quantity : 0;
  };

  // Render Components
  const FoodItemCard = ({ item }) => {
    const quantity = getItemQuantity(item);
    
    return (
      <View style={styles.foodCard}>
        <View style={styles.foodHeader}>
          <Text style={styles.foodName}>{item.name}</Text>
          <Text style={styles.caloriesBadge}>{Math.round(item.calories)} cal</Text>
        </View>
        
        <Text style={styles.stationText}>{item.station}</Text>
        
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionText}>
            P: {Math.round(item.protein)}g • C: {Math.round(item.carbs)}g • F: {Math.round(item.fat)}g
          </Text>
        </View>

        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 2).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.quantityControls}>
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => updateFoodQuantity(item, Math.max(0, quantity - 1))}
          >
            <Text style={styles.quantityButtonText}>−</Text>
          </TouchableOpacity>
          
          <Text style={styles.quantityDisplay}>{quantity}</Text>
          
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => updateFoodQuantity(item, quantity + 1)}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const MacroSummary = () => (
    <View style={styles.macroSummary}>
      <Text style={styles.macroSummaryTitle}>Today's Totals</Text>
      <View style={styles.macroRow}>
        {[
          { label: 'Calories', value: Math.round(totals.calories), goal: userGoals.calories, color: '#FF6B6B', unit: '' },
          { label: 'Protein', value: Math.round(totals.protein), goal: userGoals.protein, color: '#4ECDC4', unit: 'g' },
          { label: 'Carbs', value: Math.round(totals.carbs), goal: userGoals.carbs, color: '#45B7D1', unit: 'g' },
          { label: 'Fat', value: Math.round(totals.fat), goal: userGoals.fat, color: '#FFA07A', unit: 'g' }
        ].map((macro, index) => (
          <View key={index} style={[styles.macroCard, { borderTopColor: macro.color }]}>
            <Text style={[styles.macroValue, { color: macro.color }]}>
              {macro.value}{macro.unit}
            </Text>
            <Text style={styles.macroGoal}>/ {macro.goal}{macro.unit}</Text>
            <Text style={styles.macroLabel}>{macro.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // Screen Renders
  const renderHallSelection = () => (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <MacroSummary />
      
      <Text style={styles.screenTitle}>Choose a Dining Hall</Text>
      
      {availableHalls.map((hall, index) => (
        <TouchableOpacity
          key={index}
          style={styles.hallCard}
          onPress={() => {
            setSelectedHall(hall);
            setCurrentScreen('meals');
          }}
        >
          <Text style={styles.hallName}>{hall}</Text>
          <Text style={styles.hallArrow}>→</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderMealSelection = () => (
    <ScrollView style={styles.container}>
      <View style={styles.backButton}>
        <TouchableOpacity onPress={() => setCurrentScreen('halls')}>
          <Text style={styles.backButtonText}>← Back to Halls</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.screenTitle}>{selectedHall}</Text>
      <Text style={styles.screenSubtitle}>Choose a meal time</Text>
      
      {[
        { id: 'breakfast', name: 'Breakfast', emoji: '🌅', time: '7:00 AM - 11:00 AM' },
        { id: 'lunch', name: 'Lunch', emoji: '☀️', time: '11:00 AM - 3:00 PM' },
        { id: 'dinner', name: 'Dinner', emoji: '🌙', time: '5:00 PM - 9:00 PM' },
        { id: 'all-day', name: 'All Day Items', emoji: '🍽️', time: 'Available anytime' }
      ].map((meal) => (
        <TouchableOpacity
          key={meal.id}
          style={styles.mealCard}
          onPress={() => {
            setSelectedMeal(meal.id);
            setCurrentScreen('food');
            loadFoodForMeal(selectedHall, meal.id);
          }}
        >
          <Text style={styles.mealEmoji}>{meal.emoji}</Text>
          <View style={styles.mealInfo}>
            <Text style={styles.mealName}>{meal.name}</Text>
            <Text style={styles.mealTime}>{meal.time}</Text>
          </View>
          <Text style={styles.mealArrow}>→</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderFoodItems = () => (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.backButton}>
        <TouchableOpacity onPress={() => setCurrentScreen('meals')}>
          <Text style={styles.backButtonText}>← Back to Meals</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.screenTitle}>{selectedHall}</Text>
      <Text style={styles.screenSubtitle}>{selectedMeal.replace('-', ' ')} items</Text>
      
      {foodItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No items available for this meal time</Text>
        </View>
      ) : (
        foodItems.map((item, index) => (
          <FoodItemCard key={index} item={item} />
        ))
      )}
    </ScrollView>
  );

  const renderProgress = () => (
    <ScrollView style={styles.container}>
      <View style={styles.progressHeader}>
        <Text style={styles.screenTitle}>Daily Progress</Text>
        <TouchableOpacity style={styles.goalButton} onPress={() => setShowGoalModal(true)}>
          <Text style={styles.goalButtonText}>Edit Goals</Text>
        </TouchableOpacity>
      </View>

      <MacroSummary />

      {/* Progress bars */}
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

      {/* Selected items */}
      {selectedItems.length > 0 && (
        <View style={styles.selectedItemsList}>
          <Text style={styles.sectionTitle}>Today's Meals ({selectedItems.length} items)</Text>
          {selectedItems.map((item, index) => (
            <View key={index} style={styles.selectedItemRow}>
              <View style={styles.selectedItemInfo}>
                <Text style={styles.selectedItemName}>{item.name}</Text>
                <Text style={styles.selectedItemDetails}>
                  {item.station} • Qty: {item.quantity} • {Math.round(item.calories * item.quantity)} cal
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>UMacros</Text>
          <Text style={styles.headerSubtitle}>UM Dining Tracker</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {currentScreen === 'halls' && renderHallSelection()}
      {currentScreen === 'meals' && renderMealSelection()}
      {currentScreen === 'food' && renderFoodItems()}
      {currentScreen === 'progress' && renderProgress()}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navButton, (currentScreen === 'halls' || currentScreen === 'meals' || currentScreen === 'food') && styles.activeNavButton]}
          onPress={() => setCurrentScreen('halls')}
        >
          <Text style={[styles.navButtonText, (currentScreen === 'halls' || currentScreen === 'meals' || currentScreen === 'food') && styles.activeNavButtonText]}>
            Menu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navButton, currentScreen === 'progress' && styles.activeNavButton]}
          onPress={() => setCurrentScreen('progress')}
        >
          <Text style={[styles.navButtonText, currentScreen === 'progress' && styles.activeNavButtonText]}>
            Progress
          </Text>
        </TouchableOpacity>
      </View>

      {/* Goal Setting Modal */}
      <Modal visible={showGoalModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Daily Goals</Text>
            
            {[
              { key: 'calories', label: 'Calories', unit: 'cal' },
              { key: 'protein', label: 'Protein', unit: 'g' },
              { key: 'carbs', label: 'Carbs', unit: 'g' },
              { key: 'fat', label: 'Fat', unit: 'g' }
            ].map((goal) => (
              <View key={goal.key} style={styles.goalInputContainer}>
                <Text style={styles.goalLabel}>{goal.label} ({goal.unit})</Text>
                <TextInput
                  style={styles.goalInput}
                  value={userGoals[goal.key]}
                  onChangeText={(text) => setUserGoals(prev => ({...prev, [goal.key]: text}))}
                  keyboardType="numeric"
                  placeholder={`Enter ${goal.label.toLowerCase()} goal`}
                />
              </View>
            ))}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowGoalModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={saveGoals}
              >
                <Text style={styles.saveButtonText}>Save Goals</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Styles
const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  signOutButton: {
    padding: 10,
    backgroundColor: '#dc3545',
    borderRadius: 8,
  },
  signOutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  screenSubtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 30,
  },
  macroSummary: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  macroSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 15,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderTopWidth: 4,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  macroGoal: {
    fontSize: 12,
    color: '#6c757d',
  },
  macroLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  hallCard: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 15,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hallName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  hallArrow: {
    fontSize: 20,
    color: '#007AFF',
  },
  mealCard: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 15,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mealEmoji: {
    fontSize: 32,
    marginRight: 15,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  mealTime: {
    fontSize: 14,
    color: '#6c757d',
  },
  mealArrow: {
    fontSize: 20,
    color: '#007AFF',
  },
  foodCard: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 15,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  stationText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
  nutritionRow: {
    marginBottom: 8,
  },
  nutritionText: {
    fontSize: 13,
    color: '#6c757d',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
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
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 8,
  },
  quantityButton: {
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantityDisplay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginHorizontal: 20,
    minWidth: 30,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
    fontWeight: '500',
  },
  progressSection: {
    marginBottom: 30,
  },
  progressItem: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 15,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    marginVertical: 10,
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
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 15,
  },
  selectedItemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  selectedItemDetails: {
    fontSize: 14,
    color: '#6c757d',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingBottom: 20,
  },
  navButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  activeNavButton: {
    borderTopWidth: 3,
    borderTopColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 16,
    color: '#6c757d',
    fontWeight: '500',
  },
  activeNavButtonText: {
    color: '#007AFF',
    fontWeight: '600',
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
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 20,
    textAlign: 'center',
  },
  goalInputContainer: {
    marginBottom: 15,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    marginBottom: 5,
  },
  goalInput: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
};