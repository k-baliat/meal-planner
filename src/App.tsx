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
  DocumentData,
  getDoc
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
  cuisine: string;
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

interface Note {
  id?: string;
  date: string;
  content: string;
}

interface Notes {
  [key: string]: Note;  // date: Note
}

// Define available cuisines as a constant
const CUISINES = [
  'American',
  'Asian',
  'Colombian',
  'Hawaiian',
  'Italian',
  'Kenyan',
  'Mexican',
  'Misc'
] as const;

type Cuisine = typeof CUISINES[number];

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
  
  // Notes state
  const [notes, setNotes] = useState<Notes>({});
  const [newNote, setNewNote] = useState<string>('');
  
  //===========================================================================
  // FIREBASE INTEGRATION
  //===========================================================================

  /**
   * Get Week Range Function
   * 
   * This function takes a date and returns a string representing the week range
   * from Monday to Sunday of that week.
   * 
   * @param date - The date to get the week range for
   * @returns A string in the format "Month Day Year - Month Day Year"
   */
  const getWeekRange = (date: Date): string => {
    const startOfWeek = new Date(date);
    // Set to Monday (1) instead of Sunday (0)
    startOfWeek.setDate(date.getDate() - (date.getDay() || 7) + 1);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Set to Sunday
    
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

  // Load notes from Firestore
  useEffect(() => {
    const loadNotes = async () => {
      try {
        await ensureAuthentication();
        
        const notesRef = collection(db, collections.notes);
        const unsubscribe = onSnapshot(notesRef, (snapshot: { docs: QueryDocumentSnapshot[] }) => {
          const notesData: Notes = {};
          snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
            const note = doc.data() as Note;
            notesData[note.date] = { ...note, id: doc.id };
          });
          setNotes(notesData);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading notes:', error);
      }
    };

    loadNotes();
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

  /**
   * Save Note to Firestore
   * 
   * This function saves a note for a specific date to Firestore.
   * 
   * @param date - The date string
   * @param content - The note content
   */
  const saveNoteToFirestore = async (date: string, content: string) => {
    try {
      await ensureAuthentication();
      
      const note: Omit<Note, 'id'> = {
        date,
        content
      };

      // Check if note exists for this date
      const existingNote = notes[date];
      if (existingNote && existingNote.id) {
        // Update existing note
        const noteRef = doc(db, collections.notes, existingNote.id);
        await updateDoc(noteRef, { content });
      } else {
        // Create new note
        await addDoc(collection(db, collections.notes), note);
      }
    } catch (error) {
      console.error('Error saving note:', error);
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
        cuisine: 'Misc',
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

      // Create a map to store ingredient counts
      const ingredientCounts = new Map<string, number>();

      // Iterate through each day of the week
      Object.entries(weekPlan).forEach(([day, mealIds]) => {
        // Split mealIds and process each meal
        const mealIdList = mealIds.split(',');
        mealIdList.forEach(mealId => {
          // Find the recipe
          const recipe = recipes.find(r => r.id === mealId);
          if (!recipe) return;

          // Add each ingredient to the count map
          recipe.ingredients.forEach((ingredient: string) => {
            // Normalize the ingredient name (case-insensitive)
            const normalizedIngredient = ingredient.toLowerCase().trim();
            const currentCount = ingredientCounts.get(normalizedIngredient) || 0;
            ingredientCounts.set(normalizedIngredient, currentCount + 1);
          });
        });
      });

      // Convert the map to an array of formatted strings
      return Array.from(ingredientCounts.entries())
        .map(([ingredient, count]) => `${ingredient} (x${count})`)
        .sort((a, b) => a.localeCompare(b));
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
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const getDaysInMonth = (year: number, month: number) => {
      return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
      return new Date(year, month, 1).getDay();
    };

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);

    const calendarDays = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isCurrentDay = day === currentDate.getDate() && 
                          currentMonth === currentDate.getMonth() && 
                          currentYear === currentDate.getFullYear();
      const isSelected = day === selectedDate.getDate() && 
                        currentMonth === selectedDate.getMonth() && 
                        currentYear === selectedDate.getFullYear();
      
      // Check if this date has meals assigned
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const weekRange = getWeekRange(date);
      const mealPlan = weeklyMealPlans[weekRange];
      const hasMeals = mealPlan && mealPlan[dayOfWeek] && mealPlan[dayOfWeek] !== '';
      const mealNames = hasMeals 
        ? mealPlan[dayOfWeek].split(',')
          .map(id => recipes.find(r => r.id === id)?.name)
          .filter(Boolean)
          .join(', ')
        : '';

      calendarDays.push(
        <div 
          key={`day-${day}`} 
          className={`calendar-day ${isCurrentDay ? 'current-day' : ''} ${isSelected ? 'selected-day' : ''}`}
          onClick={() => handleDateSelect(date)}
        >
          {day}
          {hasMeals && <div className="meal-indicator" />}
          {hasMeals && (
            <div className="meal-tooltip">
              {mealNames}
            </div>
          )}
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
    const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
    const [selectedCuisine, setSelectedCuisine] = useState<Cuisine | ''>('');
    const [noteContent, setNoteContent] = useState<string>('');
    const [isNotesExpanded, setIsNotesExpanded] = useState<boolean>(false);
    const [isIngredientsExpanded, setIsIngredientsExpanded] = useState<boolean>(false);
    const [isSelectedMealsExpanded, setIsSelectedMealsExpanded] = useState<boolean>(false);

    // Load pre-selected meals and note when date changes
    useEffect(() => {
      if (selectedDate) {
        const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
        const weekRange = getWeekRange(selectedDate);
        const mealPlan = weeklyMealPlans[weekRange];
        if (mealPlan && mealPlan[dayOfWeek]) {
          setSelectedMeals(mealPlan[dayOfWeek].split(','));
        } else {
          setSelectedMeals([]);
        }

        // Load note for selected date
        const dateString = selectedDate.toISOString().split('T')[0];
        const note = notes[dateString];
        setNoteContent(note?.content || '');
      }
    }, [selectedDate, weeklyMealPlans, notes]);

    // Filter recipes by selected cuisine
    const filteredRecipes = selectedCuisine
      ? recipes.filter(recipe => recipe.cuisine === selectedCuisine)
      : recipes;

    // Sort filtered recipes alphabetically
    const sortedRecipes = [...filteredRecipes].sort((a, b) => a.name.localeCompare(b.name));

    const handleMealChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newMeal = event.target.value;
      if (newMeal === 'none') {
        setSelectedMeals([]);
      } else if (newMeal && !selectedMeals.includes(newMeal)) {
        setSelectedMeals([...selectedMeals, newMeal]);
      }
    };

    const handleRemoveMeal = (mealId: string) => {
      setSelectedMeals(selectedMeals.filter(id => id !== mealId));
    };

    const handleSaveMeal = async () => {
      if (!selectedDate) return;

      try {
        await ensureAuthentication();
        const weekRange = getWeekRange(selectedDate);
        const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

        const mealPlanRef = doc(db, collections.mealPlans, weekRange);
        const mealPlanDoc = await getDocs(collection(db, collections.mealPlans));
        const existingPlan = mealPlanDoc.docs.find(doc => doc.id === weekRange);

        const updatedPlan = {
          ...(existingPlan?.data() || {}),
          [dayOfWeek]: selectedMeals.join(',')
        };

        await setDoc(mealPlanRef, updatedPlan);
        setSelectedMeals([]);
      } catch (error) {
        console.error('Error saving meal plan:', error);
      }
    };

    const handleSaveNote = async () => {
      if (!selectedDate) return;

      try {
        const dateString = selectedDate.toISOString().split('T')[0];
        await saveNoteToFirestore(dateString, noteContent);
      } catch (error) {
        console.error('Error saving note:', error);
      }
    };

    return (
      <div className="meal-details">
        <h2>{formatDate(selectedDate)}</h2>
        
        <div className="meal-selector">
          <div className="cuisine-filter">
            <label htmlFor="cuisine-filter">Filter by Cuisine:</label>
            <select
              id="cuisine-filter"
              value={selectedCuisine}
              onChange={(e) => setSelectedCuisine(e.target.value as Cuisine | '')}
              className="cuisine-dropdown"
            >
              <option value="">All Cuisines</option>
              {CUISINES.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisine}
                </option>
              ))}
            </select>
          </div>

          <div className="recipe-selector">
            <label htmlFor="meal-dropdown">Add Recipe:</label>
            <select 
              id="meal-dropdown" 
              value="" 
              onChange={handleMealChange}
              className="meal-dropdown"
            >
              <option value="none">None</option>
              {sortedRecipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="scrollable-content">
          <div className="meal-details-content">
            <div className="selected-meals-section">
              <div 
                className="selected-meals-header"
                onClick={() => setIsSelectedMealsExpanded(!isSelectedMealsExpanded)}
              >
                <h3>Selected Meals</h3>
                <button className="toggle-selected-meals-button">
                  {isSelectedMealsExpanded ? '−' : '+'}
                </button>
              </div>
              <div className={`selected-meals-content ${isSelectedMealsExpanded ? 'expanded' : ''}`}>
                {selectedMeals.length > 0 ? (
                  selectedMeals.map(mealId => {
                    const recipe = recipes.find(r => r.id === mealId);
                    return (
                      <div key={mealId} className="selected-meal">
                        <span>{recipe?.name}</span>
                        <button 
                          className="remove-meal-button"
                          onClick={() => handleRemoveMeal(mealId)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p>No meals selected</p>
                )}
              </div>
            </div>

            <div className="ingredients-section">
              <div 
                className="ingredients-header"
                onClick={() => setIsIngredientsExpanded(!isIngredientsExpanded)}
              >
                <h3>Ingredients</h3>
                <button className="toggle-ingredients-button">
                  {isIngredientsExpanded ? '−' : '+'}
                </button>
              </div>
              <div className={`ingredients-content ${isIngredientsExpanded ? 'expanded' : ''}`}>
                {selectedMeals.length > 0 ? (
                  <ul>
                    {selectedMeals.map(mealId => {
                      const recipe = recipes.find(r => r.id === mealId);
                      return (
                        <li key={mealId} className="recipe-ingredients">
                          <h4>{recipe?.name}</h4>
                          <ul>
                            {recipe?.ingredients.map((ingredient, index) => (
                              <li key={index}>{ingredient}</li>
                            ))}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>Select recipes to view ingredients</p>
                )}
              </div>
            </div>
            
            <div className="notes-section">
              <div 
                className="notes-header"
                onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              >
                <h3>Notes</h3>
                <button className="toggle-notes-button">
                  {isNotesExpanded ? '−' : '+'}
                </button>
              </div>
              <div className={`notes-content ${isNotesExpanded ? 'expanded' : ''}`}>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add notes for this day..."
                  className="notes-textarea"
                />
                <button 
                  className="save-note-button"
                  onClick={handleSaveNote}
                  disabled={!noteContent.trim()}
                >
                  Save Note
                </button>
              </div>
            </div>
            
            <div className="save-section">
              <button 
                className="save-button" 
                onClick={handleSaveMeal}
              >
                Save Meal Plan
              </button>
            </div>
          </div>
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
    const [localCuisine, setLocalCuisine] = useState<Cuisine>('Misc');
    const [localIngredient, setLocalIngredient] = useState('');
    const [localIngredients, setLocalIngredients] = useState<string[]>([]);
    const [isAddingRecipe, setIsAddingRecipe] = useState(false);
    const [recipeSaved, setRecipeSaved] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [selectedCuisine, setSelectedCuisine] = useState<Cuisine | ''>('');

    // Reset local state when toggling add recipe form
    useEffect(() => {
      if (!isAddingRecipe && !editingRecipe) {
        setLocalRecipeName('');
        setLocalCuisine('Misc');
        setLocalIngredient('');
        setLocalIngredients([]);
        setRecipeSaved(false);
      }
    }, [isAddingRecipe, editingRecipe]);

    // Load recipe data when editing
    useEffect(() => {
      if (editingRecipe) {
        setLocalRecipeName(editingRecipe.name);
        setLocalCuisine(editingRecipe.cuisine as Cuisine);
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
            cuisine: localCuisine,
            ingredients: localIngredients
          };
          
          // Update in Firestore
          const recipeRef: DocumentReference<DocumentData> = doc(db, collections.recipes, editingRecipe.id);
          await updateDoc(recipeRef, {
            name: localRecipeName.trim(),
            cuisine: localCuisine,
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
            cuisine: localCuisine,
            ingredients: localIngredients
          };

          const newRecipeId = await saveRecipeToFirestore(recipe);
          
          const newRecipe: Recipe = {
            id: newRecipeId,
            name: localRecipeName.trim(),
            cuisine: localCuisine,
            ingredients: localIngredients
          };
          
          setRecipes(prevRecipes => [...prevRecipes, newRecipe]);
        }
        
        // Reset form
        setLocalRecipeName('');
        setLocalCuisine('Misc');
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
      setLocalCuisine('Misc');
      setLocalIngredient('');
      setLocalIngredients([]);
    };

    // Filter recipes by selected cuisine
    const filteredRecipes = selectedCuisine
      ? recipes.filter(recipe => recipe.cuisine === selectedCuisine)
      : recipes;

    // Sort filtered recipes alphabetically
    const sortedRecipes = [...filteredRecipes].sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div className="recipe-library">
        <h2>Recipe Library</h2>
        
        <div className="recipe-filters">
          <div className="cuisine-filter">
            <label htmlFor="cuisine-filter">Filter by Cuisine:</label>
            <select
              id="cuisine-filter"
              value={selectedCuisine}
              onChange={(e) => setSelectedCuisine(e.target.value as Cuisine | '')}
              className="cuisine-dropdown"
            >
              <option value="">All Cuisines</option>
              {CUISINES.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisine}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="recipe-selection">
          <label htmlFor="recipe-dropdown">Select Recipe:</label>
          <select 
            id="recipe-dropdown" 
            value={selectedRecipe} 
            onChange={handleRecipeSelect}
            className="recipe-dropdown"
          >
            <option value="">Choose a recipe...</option>
            {sortedRecipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </div>

        {selectedRecipe && !editingRecipe && (
          <div className="selected-recipe">
            <div className="recipe-header">
              <h3>{recipes.find(r => r.id === selectedRecipe)?.name}</h3>
              <span className="cuisine-tag">
                {recipes.find(r => r.id === selectedRecipe)?.cuisine}
              </span>
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
              <label htmlFor="recipe-cuisine">Cuisine:</label>
              <select
                id="recipe-cuisine"
                value={localCuisine}
                onChange={(e) => setLocalCuisine(e.target.value as Cuisine)}
                className="recipe-input"
              >
                {CUISINES.map((cuisine) => (
                  <option key={cuisine} value={cuisine}>
                    {cuisine}
                  </option>
                ))}
              </select>
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
    const [miscItem, setMiscItem] = useState('');
    const [miscItems, setMiscItems] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'shopping' | 'overview'>('shopping');

    // Load ingredients and misc items when week selection changes
    useEffect(() => {
      const loadItems = async () => {
        if (!selectedWeek) {
          setIngredients([]);
          setMiscItems([]);
          return;
        }

        setLoading(true);
        try {
          const aggregatedIngredients = await getAggregatedIngredients();
          setIngredients(aggregatedIngredients);
          
          // Load misc items from Firestore for the selected week
          const shoppingListRef = doc(db, collections.shoppingLists, selectedWeek);
          const shoppingListDoc = await getDoc(shoppingListRef);
          
          if (shoppingListDoc.exists()) {
            const data = shoppingListDoc.data();
            setMiscItems(data.miscItems || []);
          } else {
            setMiscItems([]);
          }
        } catch (error) {
          console.error('Error loading items:', error);
          setIngredients([]);
          setMiscItems([]);
        } finally {
          setLoading(false);
        }
      };

      loadItems();
    }, [selectedWeek]);

    const handleAddMiscItem = async () => {
      if (!miscItem.trim() || !selectedWeek) return;

      try {
        await ensureAuthentication();
        const newMiscItems = [...miscItems, miscItem.trim()];
        
        // Save to Firestore
        const shoppingListRef = doc(db, collections.shoppingLists, selectedWeek);
        await setDoc(shoppingListRef, {
          miscItems: newMiscItems,
          weekRange: selectedWeek
        }, { merge: true });
        
        setMiscItems(newMiscItems);
        setMiscItem('');
      } catch (error) {
        console.error('Error adding misc item:', error);
      }
    };

    const handleRemoveMiscItem = async (index: number) => {
      if (!selectedWeek) return;

      try {
        await ensureAuthentication();
        const newMiscItems = miscItems.filter((_, i) => i !== index);
        
        // Update Firestore
        const shoppingListRef = doc(db, collections.shoppingLists, selectedWeek);
        await setDoc(shoppingListRef, {
          miscItems: newMiscItems,
          weekRange: selectedWeek
        }, { merge: true });
        
        setMiscItems(newMiscItems);
      } catch (error) {
        console.error('Error removing misc item:', error);
      }
    };

    return (
      <div className="shopping-list">
        <h2>Shopping List</h2>
        
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

        {selectedWeek && (
          <div className="view-toggle">
            <label>
              <input
                type="radio"
                name="shoppingViewMode"
                value="shopping"
                checked={viewMode === 'shopping'}
                onChange={() => setViewMode('shopping')}
              />
              Shopping List
            </label>
            <label>
              <input
                type="radio"
                name="shoppingViewMode"
                value="overview"
                checked={viewMode === 'overview'}
                onChange={() => setViewMode('overview')}
              />
              Overview
            </label>
          </div>
        )}

        {selectedWeek && (
          <div className="aggregated-ingredients">
            <h3>{viewMode === 'shopping' ? 'Shopping List' : 'Meal Overview'} for {selectedWeek}</h3>
            
            {viewMode === 'shopping' ? (
              <>
                {/* Add Miscellaneous Items Section */}
                <div className="misc-items-section">
                  <h4>Add Miscellaneous Items</h4>
                  <div className="misc-item-input">
                    <input
                      type="text"
                      value={miscItem}
                      onChange={(e) => setMiscItem(e.target.value)}
                      placeholder="Enter item name..."
                      className="misc-item-text-input"
                    />
                    <button 
                      onClick={handleAddMiscItem}
                      className="add-misc-item-button"
                      disabled={!miscItem.trim()}
                    >
                      Add Item
                    </button>
                  </div>
                </div>

                {loading ? (
                  <p>Loading items...</p>
                ) : (
                  <>
                    {/* Recipe Ingredients List */}
                    {ingredients.length > 0 && (
                      <div className="recipe-ingredients-section">
                        <h4>Recipe Ingredients</h4>
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
                      </div>
                    )}

                    {/* Miscellaneous Items List */}
                    {miscItems.length > 0 && (
                      <div className="misc-items-list">
                        <h4>Miscellaneous Items</h4>
                        <ul>
                          {miscItems.map((item, index) => (
                            <li key={index} className={checkedItems.has(item) ? 'checked' : ''}>
                              <label className="shopping-item-label">
                                <input
                                  type="checkbox"
                                  checked={checkedItems.has(item)}
                                  onChange={() => handleToggleCheckedItem(item)}
                                  className="shopping-checkbox"
                                />
                                <span className="shopping-item-text">{item}</span>
                                <button 
                                  className="remove-misc-item-button"
                                  onClick={() => handleRemoveMiscItem(index)}
                                >
                                  ×
                                </button>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ingredients.length === 0 && miscItems.length === 0 && (
                      <p>No items found for this week.</p>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="meal-overview">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                  const mealPlan = weeklyMealPlans[selectedWeek];
                  const mealIds = mealPlan?.[day]?.split(',') || [];
                  const date = new Date(selectedWeek.split(' - ')[0]);
                  const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(day);
                  date.setDate(date.getDate() + dayIndex);
                  const dateString = date.toISOString().split('T')[0];
                  const note = notes[dateString];

                  return (
                    <div key={day} className="day-meals">
                      <h3>{day}</h3>
                      {mealIds.map((mealId) => {
                        const recipe = recipes.find(r => r.id === mealId);
                        return recipe ? (
                          <div key={mealId} className="meal-details">
                            <h4>{recipe.name}</h4>
                            <p className="cuisine-tag">{recipe.cuisine}</p>
                            <ul>
                              {recipe.ingredients.map((ingredient, index) => (
                                <li key={index}>{ingredient}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null;
                      })}
                      {note && (
                        <div className="day-note">
                          <h4>Notes</h4>
                          <p>{note.content}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
      {/* Banner section containing the title and tabs */}
      <div className="banner">
        {/* Title and tabs in one container */}
        <div className="banner-title-container">
          {/* The main title of our application */}
          <h1 className="banner-title">K&N Meal Planner</h1>
          
          {/* Navigation Tabs */}
          <div className="banner-tabs">
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
