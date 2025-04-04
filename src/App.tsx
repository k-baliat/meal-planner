// Import React and useState hook from the React library
// React is the core library, while useState is a "hook" that lets us add state to functional components
import React, { useState, useEffect } from 'react';

// Import Firebase and Firestore functions
import { db, collections, ensureAuthentication } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc,
  onSnapshot,
  query,
  where,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  DocumentReference,
  DocumentData
} from 'firebase/firestore';


// Import the CSS file for styling this component
// In React, we can import CSS directly into components
import './App.css';

/**
 * Define TypeScript interfaces for our data structures
 * 
 * Interfaces help TypeScript understand the shape of our data,
 * which provides better type checking and code completion.
 */
interface MealIngredientsType {
  [key: string]: string[];
}

interface Recipe {
  id?: string;  // Optional because it's added by Firestore
  name: string;
  ingredients: string[];
}

interface WeeklyMealPlan {
  [key: string]: string;  // day: recipeId
}

interface WeeklyMealPlans {
  [key: string]: WeeklyMealPlan;  // weekRange: WeeklyMealPlan
}

interface ShoppingListItem {
  checked: boolean;
  recipeName: string;
}

interface ShoppingList {
  [key: string]: ShoppingListItem;  // ingredient: ShoppingListItem
}

/**
 * App Component - The main component of our application
 * 
 * In React, we build UIs using components. Components are reusable pieces of code
 * that return React elements describing what should appear on the screen.
 * 
 * This is a functional component (as opposed to a class component).
 * Functional components are the modern and recommended way to write React components.
 */
const App: React.FC = () => {
  //===========================================================================
  // STATE MANAGEMENT
  //===========================================================================
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'mealPlanner' | 'recipeLibrary' | 'shoppingList'>('mealPlanner');
  
  // Date and meal selection state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMeal, setSelectedMeal] = useState<string>('');
  const [savedMessage, setSavedMessage] = useState<string>('');
  
  // Recipe state
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<string>('');
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newIngredient, setNewIngredient] = useState('');
  const [newRecipeIngredients, setNewRecipeIngredients] = useState<string[]>([]);
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [recipeSaved, setRecipeSaved] = useState(false);
  
  // Shopping list state
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  
  // Weekly meal plans state
  const [weeklyMealPlans, setWeeklyMealPlans] = useState<WeeklyMealPlans>({});
  
  //===========================================================================
  // FIREBASE INTEGRATION
  //===========================================================================

  /**
   * Get Week Range Function
   * 
   * This function takes a date and returns a string representing the week range
   * from Sunday to Saturday of that week.
   * 
   * @param date - The date to get the week range for
   * @returns A string in the format "Month Day Year - Month Day Year"
   */
  const getWeekRange = (date: Date): string => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Set to Sunday
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Set to Saturday
    
    const formatDate = (d: Date) => {
      return d.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    };
    
    return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;
  };

  /**
   * Load Recipes from Firestore
   * 
   * This function fetches all recipes from Firestore and updates the local state.
   * It uses onSnapshot to listen for real-time updates.
   */
  useEffect(() => {
    const loadRecipes = async () => {
      try {
        // Ensure authentication before making Firestore calls
        await ensureAuthentication();
        
        const recipesRef = collection(db, collections.recipes);
        const unsubscribe = onSnapshot(recipesRef, (snapshot: { docs: QueryDocumentSnapshot[] }) => {
          const recipesData: Recipe[] = [];
          snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
            recipesData.push({ id: doc.id, ...doc.data() } as Recipe);
          });
          setRecipes(recipesData);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading recipes:', error);
      }
    };

    loadRecipes();
  }, []);

  /**
   * Load Weekly Meal Plans from Firestore
   * 
   * This function fetches all weekly meal plans from Firestore and updates the local state.
   * It uses onSnapshot to listen for real-time updates.
   */
  useEffect(() => {
    const loadWeeklyMealPlans = async () => {
      try {
        // Ensure authentication before making Firestore calls
        await ensureAuthentication();
        
        const mealPlansRef = collection(db, collections.mealPlans);
        const unsubscribe = onSnapshot(mealPlansRef, (snapshot: { docs: QueryDocumentSnapshot[] }) => {
          const mealPlansData: WeeklyMealPlans = {};
          snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
            mealPlansData[doc.id] = doc.data() as WeeklyMealPlan;
          });
          setWeeklyMealPlans(mealPlansData);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading weekly meal plans:', error);
      }
    };

    loadWeeklyMealPlans();
  }, []);

  /**
   * Save Recipe to Firestore
   * 
   * This function saves a new recipe to Firestore and returns the document ID.
   * 
   * @param recipe - The recipe object to save
   * @returns The ID of the newly created document
   */
  const saveRecipeToFirestore = async (recipe: Omit<Recipe, 'id'>): Promise<string> => {
    try {
      // Ensure authentication before making Firestore calls
      await ensureAuthentication();
      
      const docRef = await addDoc(collection(db, collections.recipes), recipe);
      return docRef.id;
    } catch (error) {
      console.error('Error saving recipe to Firestore:', error);
      throw error;
    }
  };

  /**
   * Save Meal Plan to Firestore
   * 
   * This function saves a meal plan for a specific week to Firestore.
   * 
   * @param weekRange - The week range string (e.g., "March 23 2025 - March 29 2025")
   * @param mealPlan - The meal plan object
   */
  const saveMealPlanToFirestore = async (weekRange: string, mealPlan: WeeklyMealPlan) => {
    try {
      // Ensure authentication before making Firestore calls
      await ensureAuthentication();
      
      const docRef = doc(db, collections.mealPlans, weekRange);
      await setDoc(docRef, mealPlan);
      console.log('Meal plan saved for week:', weekRange);
    } catch (error) {
      console.error('Error saving meal plan:', error);
      throw error;
    }
  };

  /**
   * Update Shopping List in Firestore
   * 
   * This function updates the shopping list for a specific week in Firestore.
   * 
   * @param weekRange - The week range string
   * @param shoppingList - The shopping list object
   */
  const updateShoppingListInFirestore = async (weekRange: string, shoppingList: ShoppingList) => {
    try {
      // Ensure authentication before making Firestore calls
      await ensureAuthentication();
      
      const docRef = doc(db, collections.shoppingLists, weekRange);
      await updateDoc(docRef, shoppingList);
      console.log('Shopping list updated for week:', weekRange);
    } catch (error) {
      console.error('Error updating shopping list:', error);
      throw error;
    }
  };

  //===========================================================================
  // EVENT HANDLERS
  //===========================================================================

  /**
   * Event Handler Function
   * 
   * This function will be called when a tab button is clicked.
   * It updates the activeTab state to the name of the clicked tab.
   * 
   * In React, we often define handler functions inside our components
   * to respond to user interactions.
   * 
   * @param tabName - The name of the tab that was clicked
   */
  const handleTabClick = (tabName: string) => {
    setActiveTab(tabName as 'mealPlanner' | 'recipeLibrary' | 'shoppingList');
  };
  
  /**
   * Calendar Date Selection Handler
   * 
   * This function is called when a user selects a date in the calendar.
   * It updates the selectedDate state with the new date.
   * 
   * @param date - The date object that was selected
   */
  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    
    // Get the day of the week and week range
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
    const weekRange = getWeekRange(date);
    
    // Check if there's a meal plan for this week
    if (weeklyMealPlans[weekRange]) {
      // Get the recipe ID for this day
      const recipeId = weeklyMealPlans[weekRange][dayOfWeek];
      
      if (recipeId) {
        // Find the recipe in our recipes array
        const recipe = recipes.find(r => r.id === recipeId);
        if (recipe) {
          // Set the selected meal to this recipe
          setSelectedMeal(recipeId);
        }
      } else {
        // No meal selected for this day
        setSelectedMeal('');
      }
    } else {
      // No meal plan for this week
      setSelectedMeal('');
    }
  };
  
  /**
   * Meal Selection Handler
   * 
   * This function is called when a user selects a different meal from the dropdown.
   * It updates the selectedMeal state with the new meal choice.
   * 
   * @param event - The change event from the select element
   */
  const handleMealChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMeal(event.target.value);
    // Reset the saved state when a new meal is selected
    setSavedMessage('');
  };
  
  /**
   * Save Meal Plan Handler
   * 
   * This function is called when the save button is clicked.
   * It sets the saved state to true to show a confirmation message.
   * In a real app, this would save the data to a database or API.
   */
  const handleSaveMeal = async () => {
    if (!selectedDate || !selectedMeal) return;

    try {
      await ensureAuthentication();
      const weekRange = getWeekRange(selectedDate);
      const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

      const mealPlanRef = doc(db, collections.mealPlans, weekRange);
      const mealPlanDoc = await getDocs(collection(db, collections.mealPlans));
      const existingPlan = mealPlanDoc.docs.find(doc => doc.id === weekRange);

      const updatedPlan = {
        ...(existingPlan?.data() || {}),
        [dayOfWeek]: selectedMeal
      };

      await setDoc(mealPlanRef, updatedPlan);
      setSelectedMeal('');
    } catch (error) {
      console.error('Error saving meal plan:', error);
    }
  };

  /**
   * Recipe Selection Handler
   * 
   * This function is called when a user selects a recipe from the dropdown.
   * It updates the selectedRecipe state with the chosen recipe name.
   * 
   * @param event - The change event from the select element
   */
  const handleRecipeSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRecipe(event.target.value);
  };

  /**
   * Add Ingredient Handler
   * 
   * This function is called when a user adds a new ingredient to a recipe.
   * It adds the ingredient to the newRecipeIngredients array.
   */
  const handleAddIngredient = () => {
    if (newIngredient.trim()) {
      setNewRecipeIngredients([...newRecipeIngredients, newIngredient.trim()]);
      setNewIngredient(''); // Clear the input
    }
  };

  /**
   * Remove Ingredient Handler
   * 
   * This function is called when a user removes an ingredient from a recipe.
   * It removes the ingredient at the specified index from the newRecipeIngredients array.
   * 
   * @param index - The index of the ingredient to remove
   */
  const handleRemoveIngredient = (index: number) => {
    setNewRecipeIngredients(newRecipeIngredients.filter((_, i) => i !== index));
  };

  /**
   * Save Recipe Handler
   * 
   * This function handles saving a new recipe.
   * It validates the input, saves to Firestore, and updates the UI.
   */
  const handleSaveRecipe = async () => {
    if (!newRecipeName.trim() || newRecipeIngredients.length === 0) return;

    try {
      const recipe: Omit<Recipe, 'id'> = {
        name: newRecipeName.trim(),
        ingredients: newRecipeIngredients
      };

      await saveRecipeToFirestore(recipe);
      
      // Reset form
      setNewRecipeName('');
      setNewRecipeIngredients([]);
      setIsAddingRecipe(false);
      setRecipeSaved(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setRecipeSaved(false), 3000);
    } catch (error) {
      console.error('Error saving recipe:', error);
      // Handle error (e.g., show error message to user)
    }
  };

  /**
   * Shopping List Week Selection Handler
   * 
   * This function is called when a user selects a week from the dropdown.
   * It updates the selectedWeek state with the chosen week range.
   * 
   * @param event - The change event from the select element
   */
  const handleWeekSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedWeek(event.target.value);
  };

  /**
   * Toggle Checked Item Handler
   * 
   * This function is called when a user clicks a checkbox in the shopping list.
   * It toggles the checked state of the item in the checkedItems Set.
   * 
   * @param ingredient - The ingredient string to toggle
   */
  const handleToggleCheckedItem = (ingredient: string) => {
    const newCheckedItems = new Set(checkedItems);
    if (newCheckedItems.has(ingredient)) {
      newCheckedItems.delete(ingredient);
    } else {
      newCheckedItems.add(ingredient);
    }
    setCheckedItems(newCheckedItems);
  };

  /**
   * Get Aggregated Ingredients Function
   * 
   * This function aggregates all ingredients needed for the selected week's meals.
   * It includes the recipe name in parentheses for each ingredient.
   * 
   * @returns An array of formatted ingredient strings
   */
  const getAggregatedIngredients = async (): Promise<string[]> => {
    if (!selectedWeek) return [];

    try {
      // Get meal plan for the selected week
      const mealPlanRef = doc(db, collections.mealPlans, selectedWeek);
      const mealPlanDoc = await getDocs(collection(db, collections.mealPlans));
      const weekPlan = mealPlanDoc.docs.find((doc: QueryDocumentSnapshot) => doc.id === selectedWeek)?.data() as WeeklyMealPlan;

      if (!weekPlan) return [];

      const ingredients: string[] = [];

      // Iterate through each day of the week
      Object.entries(weekPlan).forEach(([day, recipeId]) => {
        // Find the recipe
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) return;

        // Add each ingredient with the recipe name in parentheses
        recipe.ingredients.forEach((ingredient: string) => {
          ingredients.push(`${ingredient} (${recipe.name})`);
        });
      });

      // Remove duplicates while preserving order
      return Array.from(new Set(ingredients));
    } catch (error) {
      console.error('Error getting aggregated ingredients:', error);
      return [];
    }
  };
  
  //===========================================================================
  // UTILITY FUNCTIONS
  //===========================================================================
  
  /**
   * Format Date Function
   * 
   * This helper function formats a Date object into a readable string.
   * 
   * @param date - The date to format
   * @returns A formatted date string (e.g., "Monday, January 1, 2023")
   */
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  //===========================================================================
  // MEAL PLANNER TAB COMPONENTS
  //===========================================================================
  
  /**
   * Calendar Component
   * 
   * This is a simple calendar component that displays the current month
   * and allows the user to select a date.
   */
  const Calendar = () => {
    // Get the current date information
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Create an array of day names for the calendar header
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Get the number of days in the current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Get the day of the week for the first day of the month (0-6, where 0 is Sunday)
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    
    // Create an array to hold all the day cells for the calendar
    const calendarDays = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isCurrentDay = day === currentDate.getDate() && 
                          currentMonth === currentDate.getMonth() && 
                          currentYear === currentDate.getFullYear();
      const isSelected = day === selectedDate.getDate() && 
                        currentMonth === selectedDate.getMonth() && 
                        currentYear === selectedDate.getFullYear();
      
      // Check if this date has a meal assigned
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const hasMeal = weeklyMealPlans[getWeekRange(date)]?.[dayOfWeek];
      
      calendarDays.push(
        <div 
          key={`day-${day}`} 
          className={`calendar-day ${isCurrentDay ? 'current-day' : ''} ${isSelected ? 'selected-day' : ''}`}
          onClick={() => handleDateSelect(date)}
        >
          {day}
          {hasMeal && <div className="meal-indicator" />}
        </div>
      );
    }
    
    return (
      <div className="calendar">
        <div className="calendar-header">
          <h2>{new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        </div>
        <div className="calendar-days-header">
          {dayNames.map(day => <div key={day} className="day-name">{day}</div>)}
        </div>
        <div className="calendar-days-grid">
          {calendarDays}
        </div>
      </div>
    );
  };
  
  /**
   * MealDetails Component
   * 
   * This component displays the details for a selected meal on a selected date.
   * It includes a dropdown to select different recipes and shows the ingredients.
   */
  const MealDetails = () => {
    return (
      <div className="meal-details">
        <h2>{formatDate(selectedDate)}</h2>
        
        <div className="meal-selector">
          <label htmlFor="meal-dropdown">Select Recipe:</label>
          <select 
            id="meal-dropdown" 
            value={selectedMeal} 
            onChange={handleMealChange}
            className="meal-dropdown"
          >
            <option value="">Choose a recipe...</option>
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="ingredients-list">
          <h3>Ingredients:</h3>
          {selectedMeal ? (
            <ul>
              {recipes.find(r => r.id === selectedMeal)?.ingredients.map((ingredient, index) => (
                <li key={index}>{ingredient}</li>
              ))}
            </ul>
          ) : (
            <p>Select a recipe to view ingredients</p>
          )}
        </div>
        
        <div className="save-section">
          <button 
            className="save-button" 
            onClick={handleSaveMeal}
            disabled={!selectedMeal}
          >
            Save Meal Plan
          </button>
          
          {savedMessage && (
            <div className="saved-message">
              {savedMessage}
            </div>
          )}
        </div>
      </div>
    );
  };

  //===========================================================================
  // RECIPE LIBRARY TAB COMPONENTS
  //===========================================================================
  
  /**
   * RecipeLibrary Component
   * 
   * This component displays the recipe library content.
   * It allows users to view saved recipes and add new ones.
   */
  const RecipeLibrary = () => {
    // Local state for managing input values
    const [localRecipeName, setLocalRecipeName] = useState('');
    const [localIngredient, setLocalIngredient] = useState('');
    const [localIngredients, setLocalIngredients] = useState<string[]>([]);
    const [isAddingRecipe, setIsAddingRecipe] = useState(false);
    const [recipeSaved, setRecipeSaved] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

    // Reset local state when toggling add recipe form
    useEffect(() => {
      if (!isAddingRecipe && !editingRecipe) {
        setLocalRecipeName('');
        setLocalIngredient('');
        setLocalIngredients([]);
        setRecipeSaved(false);
      }
    }, [isAddingRecipe, editingRecipe]);

    // Load recipe data when editing
    useEffect(() => {
      if (editingRecipe) {
        setLocalRecipeName(editingRecipe.name);
        setLocalIngredients(editingRecipe.ingredients);
      }
    }, [editingRecipe]);

    /**
     * Handle Add Ingredient
     * 
     * This function adds a new ingredient to the local ingredients list.
     */
    const handleAddLocalIngredient = () => {
      if (localIngredient.trim()) {
        setLocalIngredients(prev => [...prev, localIngredient.trim()]);
        setLocalIngredient('');
      }
    };

    /**
     * Handle Remove Ingredient
     * 
     * This function removes an ingredient from the local ingredients list.
     * 
     * @param index - The index of the ingredient to remove
     */
    const handleRemoveLocalIngredient = (index: number) => {
      setLocalIngredients(prev => prev.filter((_, i) => i !== index));
    };

    /**
     * Handle Save Recipe
     * 
     * This function saves a new recipe or updates an existing one.
     */
    const handleSaveLocalRecipe = async () => {
      if (!localRecipeName.trim() || localIngredients.length === 0) return;

      try {
        if (editingRecipe && editingRecipe.id) {
          // Update existing recipe
          const updatedRecipe: Recipe = {
            id: editingRecipe.id,
            name: localRecipeName.trim(),
            ingredients: localIngredients
          };
          
          // Update in Firestore
          const recipeRef: DocumentReference<DocumentData> = doc(db, collections.recipes, editingRecipe.id);
          await updateDoc(recipeRef, {
            name: localRecipeName.trim(),
            ingredients: localIngredients
          });
          
          // Update local state
          setRecipes(prevRecipes => 
            prevRecipes.map(recipe => 
              recipe.id === editingRecipe.id ? updatedRecipe : recipe
            )
          );
          
          // Reset editing state
          setEditingRecipe(null);
        } else {
          // Save new recipe
          const recipe: Omit<Recipe, 'id'> = {
            name: localRecipeName.trim(),
            ingredients: localIngredients
          };

          const newRecipeId = await saveRecipeToFirestore(recipe);
          
          const newRecipe: Recipe = {
            id: newRecipeId,
            name: localRecipeName.trim(),
            ingredients: localIngredients
          };
          
          setRecipes(prevRecipes => [...prevRecipes, newRecipe]);
        }
        
        // Reset form
        setLocalRecipeName('');
        setLocalIngredient('');
        setLocalIngredients([]);
        setIsAddingRecipe(false);
        setRecipeSaved(true);
        
        // Hide success message after 3 seconds
        setTimeout(() => setRecipeSaved(false), 3000);
      } catch (error) {
        console.error('Error saving recipe:', error);
      }
    };

    /**
     * Handle Edit Recipe
     * 
     * This function sets up the form for editing an existing recipe.
     * 
     * @param recipe - The recipe to edit
     */
    const handleEditRecipe = (recipe: Recipe) => {
      setEditingRecipe(recipe);
      setIsAddingRecipe(false);
    };

    /**
     * Handle Cancel Edit
     * 
     * This function cancels the editing process.
     */
    const handleCancelEdit = () => {
      setEditingRecipe(null);
      setLocalRecipeName('');
      setLocalIngredient('');
      setLocalIngredients([]);
    };

    return (
      <div className="recipe-library">
        <h2>Recipe Library</h2>
        
        {/* Recipe Selection Section */}
        <div className="recipe-selection">
          <label htmlFor="recipe-dropdown">Select Recipe:</label>
          <select 
            id="recipe-dropdown" 
            value={selectedRecipe} 
            onChange={handleRecipeSelect}
            className="recipe-dropdown"
          >
            <option value="">Choose a recipe...</option>
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Recipe Display */}
        {selectedRecipe && !editingRecipe && (
          <div className="selected-recipe">
            <div className="recipe-header">
              <h3>{recipes.find(r => r.id === selectedRecipe)?.name}</h3>
              <button 
                className="edit-recipe-button"
                onClick={() => handleEditRecipe(recipes.find(r => r.id === selectedRecipe)!)}
              >
                Edit Recipe
              </button>
            </div>
            <ul>
              {recipes.find(r => r.id === selectedRecipe)?.ingredients.map((ingredient, index) => (
                <li key={index}>{ingredient}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Add/Edit Recipe Form */}
        {(isAddingRecipe || editingRecipe) && (
          <div className="new-recipe-form">
            <h3>{editingRecipe ? 'Edit Recipe' : 'Add New Recipe'}</h3>
            
            <div className="form-group">
              <label htmlFor="recipe-name">Recipe Name:</label>
              <input
                type="text"
                id="recipe-name"
                value={localRecipeName}
                onChange={(e) => setLocalRecipeName(e.target.value)}
                placeholder="Enter recipe name"
                className="recipe-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-ingredient">Add Ingredient:</label>
              <div className="ingredient-input-group">
                <input
                  type="text"
                  id="new-ingredient"
                  value={localIngredient}
                  onChange={(e) => setLocalIngredient(e.target.value)}
                  placeholder="Enter ingredient"
                  className="recipe-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddLocalIngredient()}
                />
                <button 
                  className="add-ingredient-button"
                  onClick={handleAddLocalIngredient}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Ingredients List */}
            {localIngredients.length > 0 && (
              <div className="ingredients-list">
                <h4>Ingredients:</h4>
                <ul>
                  {localIngredients.map((ingredient, index) => (
                    <li key={index}>
                      {ingredient}
                      <button 
                        className="remove-ingredient-button"
                        onClick={() => handleRemoveLocalIngredient(index)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="form-buttons">
              <button 
                className="save-recipe-button"
                onClick={handleSaveLocalRecipe}
                disabled={!localRecipeName.trim() || localIngredients.length === 0}
              >
                {editingRecipe ? 'Update Recipe' : 'Save Recipe'}
              </button>
              <button 
                className="cancel-button"
                onClick={editingRecipe ? handleCancelEdit : () => setIsAddingRecipe(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Add New Recipe Button */}
        {!isAddingRecipe && !editingRecipe && (
          <div className="add-recipe-section">
            <button 
              className="add-recipe-button"
              onClick={() => setIsAddingRecipe(true)}
            >
              Add New Recipe
            </button>
          </div>
        )}

        {/* Save Confirmation Message */}
        {recipeSaved && (
          <div className="recipe-saved-message">
            Recipe {editingRecipe ? 'updated' : 'saved'} successfully!
          </div>
        )}
      </div>
    );
  };

  //===========================================================================
  // SHOPPING LIST TAB COMPONENTS
  //===========================================================================
  
  /**
   * ShoppingList Component
   * 
   * This component displays the shopping list content.
   * It shows a dropdown for selecting weeks and displays aggregated ingredients.
   */
  const ShoppingList = () => {
    const [ingredients, setIngredients] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Load ingredients when week selection changes
    useEffect(() => {
      const loadIngredients = async () => {
        if (!selectedWeek) {
          setIngredients([]);
          return;
        }

        setLoading(true);
        try {
          const aggregatedIngredients = await getAggregatedIngredients();
          setIngredients(aggregatedIngredients);
        } catch (error) {
          console.error('Error loading ingredients:', error);
          setIngredients([]);
        } finally {
          setLoading(false);
        }
      };

      loadIngredients();
    }, [selectedWeek]);

    return (
      <div className="shopping-list">
        <h2>Shopping List</h2>
        
        {/* Week Selection Section */}
        <div className="week-selection">
          <label htmlFor="week-dropdown">Select Week:</label>
          <select 
            id="week-dropdown" 
            value={selectedWeek} 
            onChange={handleWeekSelect}
            className="week-dropdown"
          >
            <option value="">Choose a week...</option>
            {Array.from({ length: 4 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() + (i * 7));
              const weekRange = getWeekRange(date);
              return (
                <option key={weekRange} value={weekRange}>
                  {weekRange}
                </option>
              );
            })}
          </select>
        </div>

        {/* Aggregated Ingredients List */}
        {selectedWeek && (
          <div className="aggregated-ingredients">
            <h3>Shopping List for {selectedWeek}</h3>
            {loading ? (
              <p>Loading ingredients...</p>
            ) : ingredients.length === 0 ? (
              <p>No ingredients found for this week.</p>
            ) : (
              <ul>
                {ingredients.map((ingredient, index) => (
                  <li key={index} className={checkedItems.has(ingredient) ? 'checked' : ''}>
                    <label className="shopping-item-label">
                      <input
                        type="checkbox"
                        checked={checkedItems.has(ingredient)}
                        onChange={() => handleToggleCheckedItem(ingredient)}
                        className="shopping-checkbox"
                      />
                      <span className="shopping-item-text">{ingredient}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  //===========================================================================
  // MAIN RENDER
  //===========================================================================
  
  // The return statement in a React component defines the JSX (UI) to render
  return (
    // In JSX, we use className instead of class (which is a reserved word in JavaScript)
    // JSX looks like HTML but is actually JavaScript
    <div className="App">
      {/* Banner section containing the title, tabs, and date */}
      <div className="banner">
        {/* The main title of our application */}
        <h1 className="banner-title">Kev & Nati Meal Planner</h1>
        
        {/* 
          Navigation Tabs
          
          In React, we can render lists of elements by using JavaScript's array methods.
          Here, we're rendering each tab button individually, but for larger lists,
          we would typically use .map() to iterate over an array.
        */}
        <div className="banner-tabs">
          {/* 
            Tab Button with Conditional Styling
            
            Note the following React patterns:
            
            1. Template literals with backticks (`) to combine strings and expressions
            2. Conditional classes using ternary operators
            3. Event handling with onClick and arrow functions
            
            The className will include 'active' only if this tab is the activeTab
          */}
          <button 
            className={`tab-button ${activeTab === 'mealPlanner' ? 'active' : ''}`}
            onClick={() => handleTabClick('mealPlanner')}
          >
            Meal Planner
          </button>
          <button 
            className={`tab-button ${activeTab === 'recipeLibrary' ? 'active' : ''}`}
            onClick={() => handleTabClick('recipeLibrary')}
          >
            Recipe Library
          </button>
          <button 
            className={`tab-button ${activeTab === 'shoppingList' ? 'active' : ''}`}
            onClick={() => handleTabClick('shoppingList')}
          >
            Shopping List
          </button>
        </div>
        
        {/* Display the current date in the banner */}
        <p className="banner-date">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
      </div>
      
      {/* 
        Main Content Area
        
        This section demonstrates conditional rendering, a core React concept.
        We use the && operator for conditional rendering:
        
        condition && expression
        
        If the condition is true, the expression is rendered.
        If the condition is false, React ignores and skips the expression.
      */}
      <div className="App-content">
        {/* Content changes based on which tab is active */}
        {/* This is called "conditional rendering" - showing different UI based on state */}
        
        {/* MEAL PLANNER TAB */}
        {activeTab === 'mealPlanner' && (
          /* 
            Meal Planner Layout
            
            We're using a flex container to create a two-column layout:
            - Calendar on the left (2/3 width)
            - Meal details on the right (1/3 width)
            
            This is a common pattern in React for creating responsive layouts.
          */
          <div className="meal-planner-container">
            <div className="calendar-section">
              <Calendar />
            </div>
            <div className="meal-details-section">
              <MealDetails />
            </div>
          </div>
        )}
        
        {/* RECIPE LIBRARY TAB */}
        {activeTab === 'recipeLibrary' && (
          <RecipeLibrary />
        )}
        
        {/* SHOPPING LIST TAB */}
        {activeTab === 'shoppingList' && (
          <ShoppingList />
        )}
      </div>
    </div>
  );
}

// Export the component so it can be imported and used in other files
// Every React component needs to be exported to be used elsewhere
export default App;
