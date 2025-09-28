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
  RefreshControl 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';

export default function App() {
  // Authentication state
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Your existing state variables
  const [currentTab, setCurrentTab] = useState('menu');
  const [selectedItems, setSelectedItems] = useState([]);
  const [userGoals, setUserGoals] = useState({
    calories: '2000',
    protein: '150', 
    carbs: '250',
    fat: '65'
  });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [selectedHall, setSelectedHall] = useState('South Quad');
  const [refreshing, setRefreshing] = useState(false);
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });
  const [menuData, setMenuData] = useState({ halls: {} });

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
      loadFoodMenu();
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
        // No goals found, create default goals
        await createDefaultGoals();
      }

      // Load today's food selections
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
          station: selection.food_items.station,
          quantity: selection.quantity,
          nutrition: {
            calories: selection.food_items.calories,
            protein_g: selection.food_items.protein,
            total_carbs_g: selection.food_items.carbs,
            total_fat_g: selection.food_items.fat,
            has_nutrition_data: true
          },
          dietary_tags: selection.food_items.tags || [],
          allergens: selection.food_items.allergens || []
        }));
        setSelectedItems(items);
      }
    } catch (error) {
      console.error('Error loading selections:', error);
    }
  };

  const loadFoodMenu = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: foodItems, error } = await supabase
        .from('food_items')
        .select('*')
        .eq('available_date', today);

      if (foodItems && !error && foodItems.length > 0) {
        // Group by dining hall and station
        const halls = {};
        foodItems.forEach(item => {
          if (!halls[item.dining_hall]) {
            halls[item.dining_hall] = { stations: {} };
          }
          if (!halls[item.dining_hall].stations[item.station]) {
            halls[item.dining_hall].stations[item.station] = [];
          }
          
          // Transform to match your existing structure
          halls[item.dining_hall].stations[item.station].push({
            ...item,
            nutrition: {
              calories: item.calories,
              protein_g: item.protein,
              total_carbs_g: item.carbs,
              total_fat_g: item.fat,
              has_nutrition_data: true
            },
            dietary_tags: item.tags || [],
            allergens: item.allergens || []
          });
        });
        setMenuData({ halls });
        
        // Set first hall as selected if none selected
        if (!selectedHall && Object.keys(halls).length > 0) {
          setSelectedHall(Object.keys(halls)[0]);
        }
      }
    } catch (error) {
      console.error('Error loading food menu:', error);
    }
  };

  const toggleFoodItem = async (item) => {
    try {
      const isSelected = selectedItems.some(selected => selected.id === item.id);
      const today = new Date().toISOString().split('T')[0];

      if (isSelected) {
        // Remove from selection
        const { error } = await supabase
          .from('user_food_selections')
          .delete()
          .eq('user_id', session.user.id)
          .eq('food_item_id', item.id)
          .eq('selected_date', today);

        if (!error) {
          setSelectedItems(prev => prev.filter(selected => selected.id !== item.id));
        }
      } else {
        // Add to selection
        const { error } = await supabase
          .from('user_food_selections')
          .insert({
            user_id: session.user.id,
            food_item_id: item.id,
            selected_date: today,
            quantity: 1
          });

        if (!error) {
          setSelectedItems(prev => [...prev, { ...item, station: item.station }]);
        }
      }
    } catch (error) {
      console.error('Error toggling food item:', error);
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
    await loadFoodMenu();
    await loadTodaysSelections();
    setRefreshing(false);
  };

  // Calculate totals (your existing logic)
  useEffect(() => {
    const newTotals = selectedItems.reduce((acc, item) => ({
      calories: acc.calories + (item.nutrition?.calories || 0),
      protein: acc.protein + (item.nutrition?.protein_g || 0),
      carbs: acc.carbs + (item.nutrition?.total_carbs_g || 0),
      fat: acc.fat + (item.nutrition?.total_fat_g || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    setTotals(newTotals);
  }, [selectedItems]);

  const calculateGoalProgress = (current, goal) => {
    const percentage = (current / parseFloat(goal)) * 100;
    return Math.min(percentage, 100);
  };

  // Your existing component functions
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
          <Text style={styles.caloriesBadge}>{Math.round(item.nutrition.calories)} cal</Text>
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
            P: {Math.round(item.nutrition.protein_g)}g • C: {Math.round(item.nutrition.total_carbs_g)}g • F: {Math.round(item.nutrition.total_fat_g)}g
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const GoalInput = ({ label, value, onChangeText, unit }) => (
    <View style={styles.goalInputContainer}>
      <Text style={styles.goalLabel}>{label} ({unit})</Text>
      <TextInput
        style={styles.goalInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder={`Enter ${label.toLowerCase()} goal`}
      />
    </View>
  );

  // Render different tabs
  const renderMenuTab = () => {
    const hallData = menuData.halls[selectedHall];
    if (!hallData) return (
      <View style={styles.loadingContainer}>
        <Text>Loading menu data...</Text>
      </View>
    );

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
                isSelected={selectedItems.some(selected => selected.id === item.id)}
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
      
      {/* Header with sign out */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>UMacros</Text>
          <Text style={styles.headerSubtitle}>UM Dining Tracker</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
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

// Keep all your existing styles
const styles = {
  // Add your existing styles here
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  signOutButton: {
    padding: 8,
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  hallSelector: {
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  hallButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  selectedHallButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  hallButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
  },
  selectedHallButtonText: {
    color: '#fff',
  },
  selectedSummary: {
    margin: 15,
    marginBottom: 0,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
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
    fontWeight: '500',
  },
  progressSection: {
    margin: 15,
    marginTop: 0,
  },
  progressItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
    marginBottom: 8,
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
    margin: 15,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 15,
  },
  selectedItemRow: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  selectedItemStation: {
    fontSize: 14,
    color: '#6c757d',
  },
  removeButton: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  navButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  activeNavButton: {
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 16,
    color: '#6c757d',
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
    borderRadius: 12,
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