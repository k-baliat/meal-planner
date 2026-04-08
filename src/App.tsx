// Import React and useState hook from the React library
// React is the core library, while useState is a "hook" that lets us add state to functional components
import React, { useState, useEffect, useRef } from 'react';

// Import Firebase and Firestore functions
import { db, collections, requireAuth, onAuthStateChange, signOut } from './firebase';

// Import secure logging utilities
import { secureLog, secureWarn, secureError } from './utils/secureLogger';
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
  getDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { User } from 'firebase/auth';

// Import the CSS file for styling this component
// In React, we can import CSS directly into components
import './App.css';

// Import the Chatbot component
import Chatbot from './Chatbot';

// Import the Auth component for login/signup
import Auth from './components/Auth';

// Import the ManageAccount component
import ManageAccount from './components/ManageAccount';

// Import the ShareRecipeModal component
import ShareRecipeModal from './components/ShareRecipeModal';
import DayMealModal from './components/MealRecommendationModal';
import SearchableDropdown from './components/SearchableDropdown';

// Import the auto-logout hook
import { useAutoLogout } from './hooks/useAutoLogout';

// Import Google Generative AI for ingredient categorization
import { GoogleGenerativeAI } from '@google/generative-ai';

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
  userId: string;  // Required: identifies the owner of the recipe
  notes?: string;  // Optional: user-specific notes for the recipe
  sharedWith?: string[];  // Optional: array of user IDs this recipe is shared with
  tags?: string[];  // Optional: tags for categorization (for future ML tagging)
  isPublic?: boolean;  // Optional: for future public sharing (default: false)
  visibility?: 'private' | 'shared' | 'public';  // Optional: explicit visibility state
  createdAt?: Timestamp;  // Optional: when recipe was created
  updatedAt?: Timestamp;  // Optional: last update time
  sharedAt?: Timestamp;  // Optional: when recipe was first shared
}

// User profile interface for the users collection
interface UserProfile {
  uid: string;  // Firebase Auth UID (document ID)
  email: string;  // User's email address
  firstName?: string;  // User's first name
  lastName?: string;  // User's last name
  username?: string;  // User's username (for sharing/searching)
  createdAt: Timestamp;  // When user registered
  lastActiveAt?: Timestamp;  // Last activity timestamp
}

interface WeeklyMealPlan {
  [key: string]: string;  // day: recipeId
  userId: string;  // Required: identifies the owner of the meal plan
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

// Interface for categorized ingredients with supermarket categories
interface CategorizedIngredient {
  name: string;
  category: string;
  emoji: string;
}

interface CategorizedIngredients {
  [category: string]: CategorizedIngredient[];
}

interface Note {
  id?: string;
  date: string;
  content: string;
  userId: string;  // Required: identifies the owner of the note
}

interface Notes {
  [key: string]: Note;  // date: Note
}

// Define available cuisines as a constant
const CUISINES = [
  'American',
  'Asian',
  'Colombian',
  'French',
  'Greek',
  'Hawaiian',
  'Indian',
  'Italian',
  'Japanese',
  'Kenyan',
  'Korean',
  'Mediterranean',
  'Mexican',
  'Middle Eastern',
  'Spanish',
  'Thai',
  'Vietnamese',
  'Misc'
] as const;

type Cuisine = typeof CUISINES[number];

// Define tag suggestions organized by category
// These are quick-add options that users can click to tag their recipes
const TAG_SUGGESTIONS = {
  dietary: ['gluten', 'gluten-free', 'vegetarian', 'carbs', 'dairy', 'spicy', 'sweet'],
  cooking_methods: ['grilled', 'baked', 'fried', 'slow-cooked'],
  meal_types: ['breakfast', 'dessert', 'salad', 'soup'],
  complexity: ['quick', 'simple']
};

/**
 * Helper function to remove duplicate recipes based on ID
 * 
 * When using Firestore real-time listeners, duplicates can sometimes occur
 * if state is manually updated before the listener triggers.
 * This function ensures each recipe ID appears only once.
 * 
 * @param recipes - Array of recipes that may contain duplicates
 * @returns Array of unique recipes (first occurrence kept)
 */
const deduplicateRecipes = (recipes: Recipe[]): Recipe[] => {
  const seenIds = new Set<string>();
  return recipes.filter(recipe => {
    if (!recipe.id || seenIds.has(recipe.id)) {
      return false;
    }
    seenIds.add(recipe.id);
    return true;
  });
};

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
  // AUTHENTICATION STATE
  //===========================================================================
  
  // State to track the current authenticated user
  // null means no user is logged in, User object means user is authenticated
  const [user, setUser] = useState<User | null>(null);
  
  // State to store user profile from Firestore (for username display)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // State for user dropdown menu
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  
  // State for manage account modal
  const [isManageAccountOpen, setIsManageAccountOpen] = useState(false);
  
  // State to track if we're still checking authentication status
  // This prevents showing the login screen briefly while checking auth state
  const [authLoading, setAuthLoading] = useState(true);
  
  // Set up authentication state listener
  // This runs when the component mounts and whenever auth state changes
  useEffect(() => {
    // Subscribe to authentication state changes
    const unsubscribe = onAuthStateChange((currentUser) => {
      // Additional client-side validation: ensure user has email
      // This is a safety check in case any invalid auth state slips through
      if (currentUser && !currentUser.email) {
        secureWarn('[App] User without email detected - treating as unauthenticated');
        setUser(null);
      } else {
        setUser(currentUser);
      }
      setAuthLoading(false);
    });
    
    // Cleanup: unsubscribe when component unmounts
    return () => unsubscribe();
  }, []);

  /**
   * Load User Profile from Firestore
   * 
   * This effect loads the user's profile (username, firstName, lastName) from Firestore
   * whenever the authenticated user changes or when the manage account modal closes.
   * This is used to display the username in the banner.
   */
  const loadUserProfile = async () => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    try {
      const currentUser = requireAuth();
      const userProfileRef = doc(db, collections.users, currentUser.uid);
      const userProfileSnap = await getDoc(userProfileRef);
      
      if (userProfileSnap.exists()) {
        const profileData = userProfileSnap.data() as UserProfile;
        setUserProfile(profileData);
      } else {
        // Profile doesn't exist yet, set to null
        setUserProfile(null);
      }
    } catch (error) {
      secureError('[App] Error loading user profile:', error);
      setUserProfile(null);
    }
  };

  // Load user profile when user changes
  useEffect(() => {
    loadUserProfile();
  }, [user]);

  // Reload user profile when manage account modal closes (in case username was updated)
  useEffect(() => {
    if (!isManageAccountOpen && user) {
      loadUserProfile();
    }
  }, [isManageAccountOpen, user]);
  
  // Auto-logout after 30 minutes of inactivity
  // This hook monitors user activity and automatically signs out inactive users
  useAutoLogout(30, () => {
    // Optional: You can add a notification here when auto-logout occurs
    secureLog('[App] User was automatically logged out due to inactivity');
  });
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isUserDropdownOpen && !target.closest('.user-dropdown-container')) {
        setIsUserDropdownOpen(false);
      }
    };
    
    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserDropdownOpen]);
  
  /**
   * Handle Authentication Success
   * 
   * This function is called when a user successfully logs in or signs up.
   * It updates the user state.
   * 
   * @param authenticatedUser - The authenticated user object from Firebase
   */
  const handleAuthSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };
  
  /**
   * Handle Sign Out
   * 
   * This function signs out the current user.
   */
  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  //===========================================================================
  // STATE MANAGEMENT
  //===========================================================================
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'mealPlanner' | 'recipeLibrary' | 'shoppingList'>('mealPlanner');
  
  // Chatbot state
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  
  // State to store recipe data from chatbot
  const [pendingRecipeFromChatbot, setPendingRecipeFromChatbot] = useState<Omit<Recipe, 'id'> | null>(null);
  
  // Effect to handle pending recipe from chatbot - must be at App level to work regardless of current tab
  useEffect(() => {
    if (pendingRecipeFromChatbot) {
      console.log('App: Switching to recipeLibrary tab for pending recipe');
      // Switch to recipe library tab first
      setActiveTab('recipeLibrary');
      // The RecipeLibrary component's useEffect will handle the form pre-filling
      // It watches both pendingRecipeFromChatbot and activeTab, so it will run after the tab switches
    }
  }, [pendingRecipeFromChatbot]);
  
  // Date and meal selection state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMeal, setSelectedMeal] = useState<string>('');
  const [savedMessage, setSavedMessage] = useState<string>('');
  const [isDayMealModalOpen, setIsDayMealModalOpen] = useState(false);
  const [dayMealTargetDate, setDayMealTargetDate] = useState<Date | null>(null);
  
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
   * Only loads recipes owned by the current user or shared with them.
   */
  useEffect(() => {
    // Only load recipes if user is authenticated
    if (!user) {
      setRecipes([]);
      return;
    }

    try {
      // Require authentication - throws error if not authenticated
      const currentUser = requireAuth();
      const userId = currentUser.uid;
      
      // Create a query that gets recipes owned by the user OR shared with them
      // Note: Firestore doesn't support OR queries directly, so we'll fetch both and merge
        const recipesRef = collection(db, collections.recipes);
      
      // Query for recipes owned by the user
      const ownedRecipesQuery = query(recipesRef, where('userId', '==', userId));
      
      // Listen for real-time updates
      const unsubscribe = onSnapshot(ownedRecipesQuery, (snapshot: { docs: QueryDocumentSnapshot[] }) => {
          const recipesData: Recipe[] = [];
          snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
            recipesData.push({ id: doc.id, ...doc.data() } as Recipe);
        });
        
        // Also fetch recipes shared with this user
        // We'll do this by checking all recipes and filtering client-side
        // (In production, you might want to use a separate collection for better performance)
        getDocs(recipesRef).then((allRecipesSnapshot) => {
          allRecipesSnapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
            const recipeData = doc.data() as Recipe;
            // Add recipe if it's shared with this user and not already in the list
            if (recipeData.sharedWith && 
                recipeData.sharedWith.includes(userId) && 
                recipeData.userId !== userId &&
                !recipesData.find(r => r.id === doc.id)) {
              recipesData.push({ id: doc.id, ...recipeData });
            }
          });
          setRecipes(recipesData);
        });
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading recipes:', error);
      setRecipes([]);
      }
  }, [user]);

  /**
   * Load Weekly Meal Plans from Firestore
   * 
   * This function fetches all weekly meal plans from Firestore and updates the local state.
   * It uses onSnapshot to listen for real-time updates.
   * Only loads meal plans owned by the current user.
   */
  useEffect(() => {
    // Only load meal plans if user is authenticated
    if (!user) {
      setWeeklyMealPlans({});
      return;
    }

    try {
      // Require authentication - throws error if not authenticated
      const currentUser = requireAuth();
      const userId = currentUser.uid;
      
      // Create a query that gets meal plans owned by the user
        const mealPlansRef = collection(db, collections.mealPlans);
      const mealPlansQuery = query(mealPlansRef, where('userId', '==', userId));
      
      const unsubscribe = onSnapshot(mealPlansQuery, (snapshot: { docs: QueryDocumentSnapshot[] }) => {
          const mealPlansData: WeeklyMealPlans = {};
          snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
          // Extract weekRange from document ID (format: {userId}_{weekRange})
          // Document ID format is: userId_weekRange, so we need to remove the userId prefix
          const docId = doc.id;
          const weekRange = docId.includes('_') ? docId.substring(docId.indexOf('_') + 1) : docId;
          mealPlansData[weekRange] = doc.data() as WeeklyMealPlan;
          });
          setWeeklyMealPlans(mealPlansData);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading weekly meal plans:', error);
      setWeeklyMealPlans({});
      }
  }, [user]);

  // Load notes from Firestore
  useEffect(() => {
    // Only load notes if user is authenticated
    if (!user) {
      setNotes({});
      return;
    }

    try {
      // Require authentication - throws error if not authenticated
      const currentUser = requireAuth();
      const userId = currentUser.uid;
      
      // Create a query that gets notes owned by the user
        const notesRef = collection(db, collections.notes);
      const notesQuery = query(notesRef, where('userId', '==', userId));
      
      const unsubscribe = onSnapshot(notesQuery, (snapshot: { docs: QueryDocumentSnapshot[] }) => {
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
      setNotes({});
      }
  }, [user]);

  /**
   * Save Recipe to Firestore
   * 
   * This function saves a new recipe to Firestore and returns the document ID.
   * Automatically adds the current user's ID to the recipe and applies auto-tagging.
   * 
   * @param recipe - The recipe object to save (without id and userId)
   * @returns The ID of the newly created document
   */
  const saveRecipeToFirestore = async (recipe: Omit<Recipe, 'id' | 'userId'>, manualTags?: string[]): Promise<{ id: string; tags: string[] }> => {
    try {
      // Require authentication - throws error if not authenticated
      const currentUser = requireAuth();
      const userId = currentUser.uid;
      const userEmail = currentUser.email || 'unknown';
      
      // Log recipe creation attempt (sanitized - no sensitive user data)
      secureLog('[Recipe Creation] Starting recipe save:', {
        name: recipe.name,
        cuisine: recipe.cuisine,
        ingredientCount: recipe.ingredients.length,
        hasNotes: !!recipe.notes,
        notesLength: recipe.notes?.length || 0,
        hasTags: !!recipe.tags,
        tagsCount: recipe.tags?.length || 0,
        manualTagsCount: manualTags?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Validate recipe data
      if (!recipe.name || !recipe.name.trim()) {
        throw new Error('Recipe name is required');
      }
      if (!recipe.ingredients || recipe.ingredients.length === 0) {
        throw new Error('Recipe must have at least one ingredient');
      }
      if (!recipe.cuisine) {
        throw new Error('Recipe cuisine is required');
      }
      
      // Combine manual tags with auto-generated tags
      const autoTags = generateRecipeTags(recipe);
      const allTags = Array.from(new Set([...(manualTags || []), ...autoTags])); // Remove duplicates
      secureLog('[Recipe Creation] Generated tags:', {
        autoTagsCount: autoTags.length,
        manualTagsCount: manualTags?.length || 0,
        totalTags: allTags.length,
        tags: allTags
      });
      
      // Add the user ID and tags to the recipe before saving
      const recipeWithUserId = {
        ...recipe,
        userId: userId,
        tags: allTags.length > 0 ? allTags : undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Remove undefined fields before saving to Firestore
      // Firestore doesn't allow undefined values - they must be omitted entirely
      const cleanedRecipe = Object.entries(recipeWithUserId).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);
      
      // Save to Firestore
      const docRef = await addDoc(collection(db, collections.recipes), cleanedRecipe);
      
      // Log successful creation (sanitized - no document IDs or user IDs)
      secureLog('[Recipe Creation] ✅ Recipe saved successfully:', {
        name: recipe.name,
        cuisine: recipe.cuisine,
        hasNotes: !!recipe.notes,
        notesLength: recipe.notes?.length || 0,
        tagsCount: allTags.length,
        timestamp: new Date().toISOString()
      });
      
      return { id: docRef.id, tags: allTags };
    } catch (error: any) {
      // Enhanced error logging (sanitized)
      secureError('[Recipe Creation] ❌ Error saving recipe to Firestore:', {
        error: error.message,
        code: error.code,
        recipeName: recipe.name,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  };
  
  /**
   * Generate Recipe Tags
   * 
   * This function automatically generates tags for a recipe based on its ingredients and cuisine.
   * Uses rule-based classification to categorize recipes.
   * 
   * @param recipe - The recipe to tag
   * @returns Array of tag strings
   */
  const generateRecipeTags = (recipe: Omit<Recipe, 'id' | 'userId'>): string[] => {
    const tags: string[] = [];
    const ingredients = recipe.ingredients.map(ing => ing.toLowerCase());
    const allIngredients = ingredients.join(' ');
    
    // Dietary tags based on ingredients
    if (ingredients.some(ing => ing.includes('chicken') || ing.includes('turkey') || ing.includes('beef') || ing.includes('pork') || ing.includes('fish') || ing.includes('seafood'))) {
      tags.push('protein');
    }
    if (ingredients.some(ing => ing.includes('vegetable') || ing.includes('broccoli') || ing.includes('carrot') || ing.includes('spinach') || ing.includes('lettuce') || ing.includes('tomato'))) {
      tags.push('vegetables');
    }
    if (ingredients.some(ing => ing.includes('pasta') || ing.includes('noodle') || ing.includes('rice') || ing.includes('bread'))) {
      tags.push('carbs');
    }
    if (ingredients.some(ing => ing.includes('cheese') || ing.includes('milk') || ing.includes('cream') || ing.includes('butter'))) {
      tags.push('dairy');
    }
    if (ingredients.some(ing => ing.includes('spicy') || ing.includes('chili') || ing.includes('pepper') || ing.includes('curry'))) {
      tags.push('spicy');
    }
    if (ingredients.some(ing => ing.includes('sweet') || ing.includes('sugar') || ing.includes('honey') || ing.includes('chocolate'))) {
      tags.push('sweet');
    }
    
    // Cooking method tags
    if (allIngredients.includes('grill') || allIngredients.includes('grilled')) {
      tags.push('grilled');
    }
    if (allIngredients.includes('bake') || allIngredients.includes('baked') || allIngredients.includes('oven')) {
      tags.push('baked');
    }
    if (allIngredients.includes('fry') || allIngredients.includes('fried') || allIngredients.includes('pan')) {
      tags.push('fried');
    }
    if (allIngredients.includes('slow') || allIngredients.includes('crock') || allIngredients.includes('braise')) {
      tags.push('slow-cooked');
    }
    
    // Meal type tags
    if (recipe.name.toLowerCase().includes('breakfast') || recipe.name.toLowerCase().includes('pancake') || recipe.name.toLowerCase().includes('waffle') || recipe.name.toLowerCase().includes('egg')) {
      tags.push('breakfast');
    }
    if (recipe.name.toLowerCase().includes('dessert') || recipe.name.toLowerCase().includes('cake') || recipe.name.toLowerCase().includes('cookie') || recipe.name.toLowerCase().includes('pie')) {
      tags.push('dessert');
    }
    if (recipe.name.toLowerCase().includes('salad')) {
      tags.push('salad');
    }
    if (recipe.name.toLowerCase().includes('soup') || recipe.name.toLowerCase().includes('stew')) {
      tags.push('soup');
    }
    
    // Cuisine-specific tags
    if (recipe.cuisine === 'Italian') {
      tags.push('italian');
    } else if (recipe.cuisine === 'Mexican') {
      tags.push('mexican');
    } else if (recipe.cuisine === 'Asian') {
      tags.push('asian');
    }
    
    // Quick/Easy tags
    const ingredientCount = recipe.ingredients.length;
    if (ingredientCount <= 5) {
      tags.push('simple');
    }
    if (ingredientCount <= 3) {
      tags.push('quick');
    }
    
    // Remove duplicates and return
    return Array.from(new Set(tags));
  };

  /**
   * Calculate Hash for Ingredients List
   * 
   * This function creates a simple hash of the ingredients array to detect changes.
   * Used to determine if we need to re-categorize ingredients.
   * 
   * @param ingredients - Array of ingredient strings
   * @returns Hash string representing the ingredient list
   */
  const calculateIngredientsHash = (ingredients: string[]): string => {
    // Sort ingredients and join to create a consistent hash
    const sortedIngredients = [...ingredients].sort().join('|');
    // Simple hash function (for production, consider using a proper hash library)
    let hash = 0;
    for (let i = 0; i < sortedIngredients.length; i++) {
      const char = sortedIngredients.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  };

  /**
   * Categorize Ingredients with Gemini AI
   * 
   * This function uses Google's Gemini AI to categorize ingredients into supermarket departments.
   * It sends the ingredients to Gemini and receives categorized results with emojis.
   * 
   * @param ingredients - Array of ingredient strings (e.g., ["chicken (x2)", "onion (x1)"])
   * @returns Promise resolving to categorized ingredients grouped by category
   */
  const categorizeIngredientsWithGemini = async (ingredients: string[]): Promise<CategorizedIngredients> => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Gemini API key not found. Please add REACT_APP_GEMINI_API_KEY to your .env file.');
    }

    try {
      // Initialize Gemini AI
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: 'models/gemini-2.5-flash',
        systemInstruction: 'You are a precise JSON processor. Return only valid JSON without markdown code blocks or explanations.'
      });

      // Prepare ingredients in the format expected by the prompt
      // Parse ingredients to extract name and quantity
      const ingredientsForAI = ingredients.map(ing => {
        // Handle format like "chicken (x2)" or "2 cups flour"
        const match = ing.match(/^(.+?)\s*\(x(\d+)\)$/);
        if (match) {
          return {
            name: match[1].trim(),
            quantity: `x${match[2]}`
          };
        }
        // If no count, try to extract quantity from the beginning
        const quantityMatch = ing.match(/^(\d+\s*(?:cups?|tbsp|tsp|lb|oz|g|kg|ml|l)?)\s+(.+)$/i);
        if (quantityMatch) {
          return {
            name: quantityMatch[2].trim(),
            quantity: quantityMatch[1].trim()
          };
        }
        // Fallback: use entire string as name
        return {
          name: ing.trim(),
          quantity: ''
        };
      });

      // Create the categorization prompt
      const categorizationPrompt = `You are a supermarket categorization assistant. Your task is to tag recipe ingredients with their appropriate supermarket department/aisle categories.

Available Categories:
- Produce 🥬 (fresh fruits, vegetables, herbs)
- Bakery 🥖 (bread, tortillas, baked goods)
- Dairy 🥛 (milk, cheese, yogurt, butter, eggs)
- Meat 🥩 (beef, pork, poultry, seafood)
- Frozen ❄️ (frozen vegetables, ice cream, frozen meals)
- Canned 🥫 (canned goods, jarred items, preserved foods)
- Spices 🌶️ (dried spices, seasonings, extracts, baking ingredients like flour and sugar)
- International 🌍 (specialty international ingredients)
- Latin 🌮 (Latin American specialty items)
- Snacks 🍿 (chips, crackers, cookies, candy)
- Beverages 🥤 (drinks, juices, soda)
- Condiments 🍯 (sauces, dressings, oils, vinegar)
- Pantry 🏺 (pasta, rice, beans, grains)
- Utensils 🍴 (cooking tools)

Return the same JSON structure with 'category' and 'emoji' fields added to each ingredient. Output ONLY valid JSON.

Input: ${JSON.stringify({ ingredients: ingredientsForAI })}`;

      // Call Gemini API
      const result = await model.generateContent(categorizationPrompt);
      const response = await result.response;
      const text = response.text();

      // Extract JSON from response (remove markdown code blocks if present)
      let jsonText = text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      // Parse the JSON response
      const categorizedData = JSON.parse(jsonText);

      // Validate and transform the response
      if (!categorizedData.ingredients || !Array.isArray(categorizedData.ingredients)) {
        throw new Error('Invalid response format from Gemini API');
      }

      // Group ingredients by category
      const grouped: CategorizedIngredients = {};
      
      categorizedData.ingredients.forEach((item: any, index: number) => {
        const category = item.category || 'Pantry';
        const emoji = item.emoji || '🏺';
        const originalIngredient = ingredients[index]; // Use original format with counts
        
        if (!grouped[category]) {
          grouped[category] = [];
        }
        
        grouped[category].push({
          name: originalIngredient, // Keep original format like "chicken (x2)"
          category: category,
          emoji: emoji
        });
      });

      return grouped;
    } catch (error: any) {
      console.error('Error categorizing ingredients with Gemini:', error);
      // Fallback: return ingredients in a default category if API fails
      const fallback: CategorizedIngredients = {
        'Pantry': ingredients.map(ing => ({
          name: ing,
          category: 'Pantry',
          emoji: '🏺'
        }))
      };
      return fallback;
    }
  };

  /**
   * Save Meal Plan to Firestore
   * 
   * This function saves a meal plan for a specific week to Firestore.
   * Automatically adds the current user's ID to the meal plan.
   * 
   * @param weekRange - The week range string (e.g., "March 23 2025 - March 29 2025")
   * @param mealPlan - The meal plan object (without userId)
   */
  const saveMealPlanToFirestore = async (weekRange: string, mealPlan: Omit<WeeklyMealPlan, 'userId'>) => {
    try {
      // Require authentication - throws error if not authenticated
      const currentUser = requireAuth();
      const userId = currentUser.uid;
      const userEmail = currentUser.email || 'unknown';
      
      // Validate meal plan data
      if (!weekRange || !weekRange.trim()) {
        throw new Error('Week range is required');
      }
      
      // Log meal plan save attempt
      console.log('[Meal Plan] Saving meal plan:', {
        weekRange: weekRange,
        userId: userId,
        userEmail: userEmail,
        daysWithMeals: Object.keys(mealPlan).filter(key => mealPlan[key as keyof typeof mealPlan] && mealPlan[key as keyof typeof mealPlan] !== ''),
        timestamp: new Date().toISOString()
      });
      
      // Use a unique document ID that includes the user ID to prevent conflicts
      // This ensures meal plans are user-specific and future-proof
      // Format: {userId}_{weekRange}
      const docId = `${userId}_${weekRange}`;
      const docRef = doc(db, collections.mealPlans, docId);
      
      // Validate document ID format
      if (!docId.includes('_') || !docId.startsWith(userId + '_')) {
        throw new Error(`Invalid meal plan document ID format: ${docId}. Must be {userId}_{weekRange}`);
      }
      
      // Check if document already exists
      const existingDoc = await getDoc(docRef);
      
      // Add the user ID to the meal plan before saving
      // This ensures the document data also contains userId for querying
      const mealPlanWithUserId: any = {
        ...mealPlan,
        userId: userId,  // REQUIRED: Ensures user-specific data
        weekRange: weekRange,
        updatedAt: serverTimestamp()
      };
      
      if (existingDoc.exists()) {
        secureLog('[Meal Plan] Updating existing meal plan');
      } else {
        mealPlanWithUserId.createdAt = serverTimestamp();
        secureLog('[Meal Plan] Creating new meal plan');
      }
      
      await setDoc(docRef, mealPlanWithUserId);
      
      // Verify the save was successful
      const savedDoc = await getDoc(docRef);
      if (!savedDoc.exists()) {
        throw new Error('Failed to save meal plan - document not found after save');
      }
      
      const savedData = savedDoc.data();
      if (savedData?.userId !== userId) {
        throw new Error(`Meal plan userId mismatch: expected ${userId}, got ${savedData?.userId}`);
      }
      
      // Log successful save
      console.log('[Meal Plan] ✅ Meal plan saved successfully:', {
        docId: docId,
        weekRange: weekRange,
        userId: userId,
        verified: true,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[Meal Plan] ❌ Error saving meal plan:', {
        error: error.message,
        code: error.code,
        weekRange: weekRange,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  };

  /**
   * Update Shopping List in Firestore
   * 
   * This function updates the shopping list for a specific week in Firestore.
   * Automatically adds the current user's ID to the shopping list.
   * 
   * @param weekRange - The week range string
   * @param shoppingList - The shopping list object
   */
  const updateShoppingListInFirestore = async (weekRange: string, shoppingList: ShoppingList) => {
    try {
      // Require authentication - throws error if not authenticated
      const currentUser = requireAuth();
      const userId = currentUser.uid;
      const userEmail = currentUser.email || 'unknown';
      
      // Validate shopping list data
      if (!weekRange || !weekRange.trim()) {
        throw new Error('Week range is required');
      }
      
      // Log shopping list update attempt
      console.log('[Shopping List] Updating shopping list:', {
        weekRange: weekRange,
        userId: userId,
        userEmail: userEmail,
        checkedItemsCount: Array.isArray(shoppingList.checkedItems) ? shoppingList.checkedItems.length : 0,
        miscItemsCount: Array.isArray(shoppingList.miscItems) ? shoppingList.miscItems.length : 0,
        timestamp: new Date().toISOString()
      });
      
      // Use a unique document ID that includes the user ID to prevent conflicts
      // This ensures shopping lists are user-specific and future-proof
      // Format: {userId}_{weekRange}
      const docId = `${userId}_${weekRange}`;
      const docRef = doc(db, collections.shoppingLists, docId);
      
      // Validate document ID format
      if (!docId.includes('_') || !docId.startsWith(userId + '_')) {
        throw new Error(`Invalid shopping list document ID format: ${docId}. Must be {userId}_{weekRange}`);
      }
      
      // Check if document already exists
      const existingDoc = await getDoc(docRef);
      const shoppingListData: any = {
        ...shoppingList,
        userId: userId,  // REQUIRED: Ensures user-specific data
        weekRange: weekRange,
        updatedAt: serverTimestamp()
      };
      
      if (!existingDoc.exists()) {
        shoppingListData.createdAt = serverTimestamp();
        secureLog('[Shopping List] Creating new shopping list');
      } else {
        secureLog('[Shopping List] Updating existing shopping list');
      }
      
      // Use setDoc with merge to update or create the document
      await setDoc(docRef, shoppingListData, { merge: true });
      
      // Verify the save was successful
      const savedDoc = await getDoc(docRef);
      if (!savedDoc.exists()) {
        throw new Error('Failed to save shopping list - document not found after save');
      }
      
      const savedData = savedDoc.data();
      if (savedData?.userId !== userId) {
        throw new Error(`Shopping list userId mismatch: expected ${userId}, got ${savedData?.userId}`);
      }
      
      // Log successful update
      console.log('[Shopping List] ✅ Shopping list updated successfully:', {
        docId: docId,
        weekRange: weekRange,
        userId: userId,
        verified: true,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[Shopping List] ❌ Error updating shopping list:', {
        error: error.message,
        code: error.code,
        weekRange: weekRange,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  };

  /**
   * Save Note to Firestore
   * 
   * This function saves a note for a specific date to Firestore.
   * Automatically adds the current user's ID to the note.
   * 
   * @param date - The date string
   * @param content - The note content
   */
  const saveNoteToFirestore = async (date: string, content: string) => {
    try {
      // Require authentication - throws error if not authenticated
      const currentUser = requireAuth();
      const userId = currentUser.uid;
      
      const note: Omit<Note, 'id'> = {
        date,
        content,
        userId: userId
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
   * Save selected meals for a specific date using the existing meal-plan format.
   *
   * This keeps Firestore writes consistent with the current autosave behavior:
   * document id format: {userId}_{weekRange}
   * day value format: comma-joined recipe IDs
   */
  const saveMealsForDate = async (date: Date, mealIds: string[]) => {
    const weekRange = getWeekRange(date);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

    // Get existing meal plan for this week
    const currentUser = requireAuth();
    const userId = currentUser.uid;
    const docId = `${userId}_${weekRange}`;
    const mealPlanRef = doc(db, collections.mealPlans, docId);
    const mealPlanDoc = await getDoc(mealPlanRef);
    const existingPlan = mealPlanDoc.exists() ? mealPlanDoc.data() as WeeklyMealPlan : null;

    const updatedPlan = {
      ...(existingPlan || {}),
      [dayOfWeek]: mealIds.join(',')
    };

    // Remove userId from the plan object before passing to saveMealPlanToFirestore
    const { userId: _, ...planWithoutUserId } = updatedPlan;
    await saveMealPlanToFirestore(weekRange, planWithoutUserId);
  };

  /**
   * Calendar Date Click Handler
   *
   * Opens the day meal modal for any clicked date.
   */
  const handleCalendarDateClick = async (date: Date) => {
    setSelectedDate(date);
    setDayMealTargetDate(date);
    setIsDayMealModalOpen(true);
  };

  /**
   * Day meal modal auto-save handler.
   * Saves meals immediately using the existing Firestore contract.
   */
  const handleDayMealModalAutoSave = async (targetDate: Date, recipeIds: string[]) => {
    try {
      await saveMealsForDate(targetDate, recipeIds);
      setSelectedDate(targetDate);
    } catch (error) {
      console.error('Error saving day meals:', error);
    }
  };

  /**
   * Day meal modal close handler.
   * Ensures selectedDate is synced with the currently viewed day.
   */
  const handleDayMealModalClose = (targetDate: Date) => {
    setSelectedDate(targetDate);
    setIsDayMealModalOpen(false);
    setDayMealTargetDate(null);
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
      const weekRange = getWeekRange(selectedDate);
      const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

      // Get existing meal plan for this week
      const currentUser = requireAuth();
      const userId = currentUser.uid;
      const docId = `${userId}_${weekRange}`;
      const mealPlanRef = doc(db, collections.mealPlans, docId);
      const mealPlanDoc = await getDoc(mealPlanRef);
      const existingPlan = mealPlanDoc.exists() ? mealPlanDoc.data() as WeeklyMealPlan : null;

      const updatedPlan = {
        ...(existingPlan || {}),
        [dayOfWeek]: selectedMeal
      };

      // Remove userId from the plan object before passing to saveMealPlanToFirestore
      const { userId: _, ...planWithoutUserId } = updatedPlan;
      await saveMealPlanToFirestore(weekRange, planWithoutUserId);
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
   * Note: This is a legacy function. The RecipeLibrary component has its own save handler.
   */
  const handleSaveRecipe = async () => {
    if (!newRecipeName.trim() || newRecipeIngredients.length === 0) return;

    try {
      // Create recipe object without id and userId
      // saveRecipeToFirestore will automatically add the userId
      const recipe: Omit<Recipe, 'id' | 'userId'> = {
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
  const handleToggleCheckedItem = async (item: string) => {
    // Update local state immediately for responsive UI
    setCheckedItems(prev => {
      const newChecked = new Set(prev);
      if (newChecked.has(item)) {
        newChecked.delete(item);
      } else {
        newChecked.add(item);
      }
      // Save to Firestore in the background (user-specific)
      if (selectedWeek) {
        try {
          const currentUser = requireAuth();
          const userId = currentUser.uid;
          const docId = `${userId}_${selectedWeek}`;
          const shoppingListRef = doc(db, collections.shoppingLists, docId);
        setDoc(shoppingListRef, {
          checkedItems: Array.from(newChecked),
            weekRange: selectedWeek,
            userId: userId
        }, { merge: true });
          secureLog(`[Shopping List] Updated checked items for week ${selectedWeek}`);
        } catch (error) {
          secureError('[Shopping List] Error saving checked items:', error);
        }
      }
      return newChecked;
    });
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
      // Get meal plan for the selected week (user-specific)
      const currentUser = requireAuth();
      const userId = currentUser.uid;
      const docId = `${userId}_${selectedWeek}`;
      const mealPlanRef = doc(db, collections.mealPlans, docId);
      const mealPlanDoc = await getDoc(mealPlanRef);
      const weekPlan = mealPlanDoc.exists() ? mealPlanDoc.data() as WeeklyMealPlan : null;

      if (!weekPlan) return [];

      // Create a map to store ingredient counts
      const ingredientCounts = new Map<string, number>();

      // Define valid day names to filter out metadata fields like userId, weekRange, createdAt, updatedAt
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      // Iterate through each day of the week, filtering out non-day keys
      Object.entries(weekPlan).forEach(([day, mealIds]) => {
        // Skip non-day keys (like userId, weekRange, createdAt, updatedAt)
        if (!validDays.includes(day)) return;
        
        // Skip if mealIds is not a string or is empty
        if (typeof mealIds !== 'string' || !mealIds.trim()) return;
        
        // Split mealIds and process each meal
        const mealIdList = mealIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
        mealIdList.forEach(mealId => {
          // Find the recipe
          const recipe = recipes.find(r => r.id === mealId);
          if (!recipe || !recipe.ingredients) return;

          // Add each ingredient to the count map
          recipe.ingredients.forEach((ingredient: string) => {
            // Normalize the ingredient name (case-insensitive)
            const normalizedIngredient = ingredient.toLowerCase().trim();
            if (normalizedIngredient) {
              const currentCount = ingredientCounts.get(normalizedIngredient) || 0;
              ingredientCounts.set(normalizedIngredient, currentCount + 1);
            }
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
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Sync displayed month with selectedDate when it changes.
    // This keeps the calendar on the selected month when choosing a past or future date,
    // instead of resetting to the current month (which happened when Calendar remounted on App re-render).
    useEffect(() => {
      setCurrentMonth(selectedDate.getMonth());
      setCurrentYear(selectedDate.getFullYear());
      // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedDate from parent; sync displayed month when user selects any date
    }, [selectedDate]);

    const handlePreviousMonth = () => {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(prev => prev - 1);
      } else {
        setCurrentMonth(prev => prev - 1);
      }
    };

    const handleNextMonth = () => {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(prev => prev + 1);
      } else {
        setCurrentMonth(prev => prev + 1);
      }
    };

    const getDaysInMonth = (year: number, month: number) => {
      // Get the last day of the month by using day 0 of the next month
      return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
      // Get the day of the week for the first day of the month (0 = Sunday, 6 = Saturday)
      return new Date(year, month, 1).getDay();
    };

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);
    // Calculate how many days we need to show in the calendar grid
    // We need to fill a 7-day week grid, so calculate total cells needed
    const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;
    const daysToShow = totalCells - firstDayOfMonth;

    const calendarDays = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Add cells for all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isCurrentDay = day === new Date().getDate() && 
                          currentMonth === new Date().getMonth() && 
                          currentYear === new Date().getFullYear();
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
          onClick={() => handleCalendarDateClick(date)}
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
    
    // Add empty cells at the end to complete the calendar grid
    // This ensures the last days of the month are always visible
    const remainingCells = totalCells - (firstDayOfMonth + daysInMonth);
    for (let i = 0; i < remainingCells; i++) {
      calendarDays.push(<div key={`empty-end-${i}`} className="calendar-day empty"></div>);
    }

    return (
      <div className="calendar">
        <div className="calendar-header">
          <button 
            className="month-nav-button"
            onClick={handlePreviousMonth}
            aria-label="Previous month"
          >
            &lt;
          </button>
          <h2>{new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <button 
            className="month-nav-button"
            onClick={handleNextMonth}
            aria-label="Next month"
          >
            &gt;
          </button>
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
  
  //===========================================================================
  // RECIPE LIBRARY TAB COMPONENTS
  //===========================================================================
  
  /**
   * SharedRecipeOwner Component
   * 
   * Fetches and displays the owner's username or email for shared recipes.
   */
  const SharedRecipeOwner: React.FC<{ userId: string }> = ({ userId }) => {
    const [ownerInfo, setOwnerInfo] = useState<string>('Loading...');
    
    useEffect(() => {
      const fetchOwnerInfo = async () => {
        try {
          const ownerProfileRef = doc(db, collections.users, userId);
          const ownerProfileSnap = await getDoc(ownerProfileRef);
          
          if (ownerProfileSnap.exists()) {
            const profileData = ownerProfileSnap.data() as UserProfile;
            if (profileData.username) {
              setOwnerInfo(`@${profileData.username}`);
            } else if (profileData.firstName && profileData.lastName) {
              setOwnerInfo(`${profileData.firstName} ${profileData.lastName}`);
            } else {
              setOwnerInfo(profileData.email);
            }
          } else {
            setOwnerInfo('Unknown user');
          }
        } catch (error) {
          console.error('Error fetching owner info:', error);
          setOwnerInfo('Unknown user');
        }
      };
      
      fetchOwnerInfo();
    }, [userId]);
    
    return <span className="created-by-email">{ownerInfo}</span>;
  };
  
  /**
   * SharedRecipeDetails Component
   * 
   * Displays shared recipe details in read-only mode.
   */
  const SharedRecipeDetails: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
    return (
      <div className="recipe-details-view">
        <div className="recipe-details-header">
          <h2 className="recipe-details-title">{recipe.name}</h2>
          <div className="shared-recipe-label">
            Shared Recipe (Read-only)
          </div>
        </div>
        
        <div className="recipe-details-content">
          {/* Cuisine Badge */}
          <div className="recipe-detail-section">
            <span className="recipe-detail-label">Cuisine:</span>
            <span className="recipe-cuisine-badge">{recipe.cuisine}</span>
          </div>
          
          {/* Ingredients */}
          <div className="recipe-detail-section">
            <h3 className="recipe-section-title">Ingredients</h3>
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <ul className="recipe-ingredients-list">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="recipe-ingredient-item">
                    {ingredient}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-data-message">No ingredients listed</p>
            )}
          </div>
          
          {/* Notes */}
          {recipe.notes && (
            <div className="recipe-detail-section">
              <h3 className="recipe-section-title">Notes</h3>
              <div className="recipe-notes-display">
                {recipe.notes}
              </div>
            </div>
          )}
          
          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="recipe-detail-section">
              <h3 className="recipe-section-title">Tags</h3>
              <div className="recipe-tags-display">
                {recipe.tags.map((tag, index) => (
                  <span key={index} className="recipe-tag-badge">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Shared By - Show owner's info */}
          <div className="recipe-detail-section">
            <span className="recipe-detail-label">Shared by:</span>
            <div className="created-by-display">
              <SharedRecipeOwner userId={recipe.userId} />
            </div>
          </div>
        </div>
      </div>
    );
  };
  
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
    const [localRecipeNotes, setLocalRecipeNotes] = useState('');
    const [localRecipeTags, setLocalRecipeTags] = useState<string[]>([]);
    const [localTagInput, setLocalTagInput] = useState('');
    const [isAddingRecipe, setIsAddingRecipe] = useState(false);
    const [recipeSaved, setRecipeSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [selectedCuisine, setSelectedCuisine] = useState<Cuisine | ''>('');
    // State for recipe library sub-tabs: 'addNewRecipe', 'myRecipes', or 'sharedWithMe'
    const [recipeViewMode, setRecipeViewMode] = useState<'addNewRecipe' | 'myRecipes' | 'sharedWithMe'>('myRecipes');
    // State for selected recipe in My Recipes tab
    const [selectedMyRecipe, setSelectedMyRecipe] = useState<Recipe | null>(null);
    // State for selected recipe in Shared with Me tab
    const [selectedSharedRecipe, setSelectedSharedRecipe] = useState<Recipe | null>(null);
    // State for cuisine filter in Shared with Me tab
    const [selectedSharedCuisine, setSelectedSharedCuisine] = useState<Cuisine | ''>('');
    // State for "Shared By" filter in Shared with Me tab
    const [selectedSharedBy, setSelectedSharedBy] = useState<string>('');
    // State for "Tags" filter in Shared with Me tab
    const [selectedSharedTag, setSelectedSharedTag] = useState<string>('');
    // State for user emails map (for Shared By filter display)
    const [sharedRecipeUserEmails, setSharedRecipeUserEmails] = useState<Record<string, string>>({});
    // State for edit modal in My Recipes tab
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // Handle pending recipe from chatbot
    // This effect runs when the component mounts or when pendingRecipeFromChatbot changes
    // It pre-fills the form with recipe data from the chatbot
    // We check both pendingRecipeFromChatbot and activeTab to ensure we're on the right tab
    useEffect(() => {
      // Only process if we're on the recipe library tab (component is mounted) and there's a pending recipe
      if (pendingRecipeFromChatbot && activeTab === 'recipeLibrary') {
        console.log('RecipeLibrary: Pre-filling recipe form with:', pendingRecipeFromChatbot);
        
        // Switch to Add New Recipe tab
        setRecipeViewMode('addNewRecipe');
        
        // Pre-fill the form with recipe data
        setLocalRecipeName(pendingRecipeFromChatbot.name);
        setLocalCuisine(pendingRecipeFromChatbot.cuisine as Cuisine);
        setLocalIngredients(pendingRecipeFromChatbot.ingredients);
        setLocalRecipeTags(pendingRecipeFromChatbot.tags || []);
        setIsAddingRecipe(true);
        
        // Clear the pending recipe after using it
        setPendingRecipeFromChatbot(null);
      }
    }, [pendingRecipeFromChatbot, activeTab]);

    // Reset local state when switching away from add new recipe tab or when not editing
    useEffect(() => {
      // Only clear form if we're not editing and not in add new recipe tab
      if (recipeViewMode !== 'addNewRecipe' && !editingRecipe) {
        setLocalRecipeName('');
        setLocalCuisine('Misc');
        setLocalIngredient('');
        setLocalIngredients([]);
        setLocalRecipeNotes('');
        setLocalRecipeTags([]);
        setLocalTagInput('');
        setRecipeSaved(false);
        setSaveError(null);
        setIsAddingRecipe(false);
      } else if (recipeViewMode === 'addNewRecipe' && !editingRecipe) {
        // When switching to add new recipe tab, show the form
        setIsAddingRecipe(true);
      }
      // If editing in My Recipes tab, keep the form data - don't clear it
    }, [recipeViewMode, editingRecipe]);

    // Load user emails for Shared with Me tab filters
    // This effect runs when we're in the sharedWithMe tab and recipes change
    useEffect(() => {
      const loadUserEmailsForSharedRecipes = async () => {
        if (recipeViewMode !== 'sharedWithMe') {
          return;
        }
        
        const currentUser = requireAuth();
        const userId = currentUser.uid;
        
        // Get recipes shared with current user
        const sharedRecipes = recipes.filter(recipe => 
          recipe.sharedWith && 
          recipe.sharedWith.includes(userId) && 
          recipe.userId !== userId
        );
        
        // Get unique owner IDs
        const uniqueOwnerIds = Array.from(new Set(sharedRecipes.map(recipe => recipe.userId)));
        
        // Load emails for these users
        const emailsMap: Record<string, string> = {};
        for (const ownerId of uniqueOwnerIds) {
          try {
            const userDoc = await getDoc(doc(db, collections.users, ownerId));
            if (userDoc.exists()) {
              const userData = userDoc.data() as UserProfile;
              emailsMap[ownerId] = userData.email;
            }
          } catch (error) {
            secureError('[App] Error loading user email:', error);
            emailsMap[ownerId] = 'Unknown User';
          }
        }
        setSharedRecipeUserEmails(emailsMap);
      };
      
      loadUserEmailsForSharedRecipes();
    }, [recipeViewMode, recipes]);

    // Load recipe data when editing
    // This effect runs whenever editingRecipe changes and pre-fills the form
    useEffect(() => {
      if (editingRecipe) {
        console.log('[My Recipes] Loading recipe data for editing:', editingRecipe.name);
        setLocalRecipeName(editingRecipe.name);
        setLocalCuisine(editingRecipe.cuisine as Cuisine);
        setLocalIngredients(editingRecipe.ingredients);
        // Load recipe notes if they exist
        setLocalRecipeNotes(editingRecipe.notes || '');
        // Load recipe tags if they exist
        setLocalRecipeTags(editingRecipe.tags || []);
        setLocalTagInput(''); // Clear tag input
        setSaveError(null); // Clear any previous errors
      }
    }, [editingRecipe]);

    // Load recipe data when a recipe is selected in My Recipes tab
    // This effect runs whenever selectedMyRecipe changes and pre-fills the form
    useEffect(() => {
      if (selectedMyRecipe) {
        console.log('[My Recipes] Loading recipe data for editing:', selectedMyRecipe.name);
        setLocalRecipeName(selectedMyRecipe.name);
        setLocalCuisine(selectedMyRecipe.cuisine as Cuisine);
        setLocalIngredients(selectedMyRecipe.ingredients);
        // Load recipe notes if they exist
        setLocalRecipeNotes(selectedMyRecipe.notes || '');
        // Load recipe tags if they exist
        setLocalRecipeTags(selectedMyRecipe.tags || []);
        setLocalTagInput(''); // Clear tag input
        setSaveError(null); // Clear any previous errors
      } else {
        // Clear form when no recipe is selected
        setLocalRecipeName('');
        setLocalCuisine('Misc');
        setLocalIngredient('');
        setLocalIngredients([]);
        setLocalRecipeNotes('');
        setLocalRecipeTags([]);
        setLocalTagInput('');
        setSaveError(null);
      }
    }, [selectedMyRecipe]);

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
     * Handle Add Tag
     * 
     * This function adds a new tag to the local tags list.
     */
    const handleAddLocalTag = () => {
      if (localTagInput.trim() && !localRecipeTags.includes(localTagInput.trim().toLowerCase())) {
        setLocalRecipeTags(prev => [...prev, localTagInput.trim().toLowerCase()]);
        setLocalTagInput('');
      }
    };

    /**
     * Handle Add Suggested Tag
     * 
     * This function adds a suggested tag to the local tags list.
     * It checks if the tag is already added to prevent duplicates.
     * 
     * @param tag - The suggested tag to add
     */
    const handleAddSuggestedTag = (tag: string) => {
      const tagLower = tag.toLowerCase();
      if (!localRecipeTags.includes(tagLower)) {
        setLocalRecipeTags(prev => [...prev, tagLower]);
      }
    };

    /**
     * Handle Remove Tag
     * 
     * This function removes a tag from the local tags list.
     * 
     * @param index - The index of the tag to remove
     */
    const handleRemoveLocalTag = (index: number) => {
      setLocalRecipeTags(prev => prev.filter((_, i) => i !== index));
    };

    /**
     * Handle Save Recipe
     * 
     * This function saves a new recipe or updates an existing one.
     */
    const handleSaveLocalRecipe = async () => {
      if (!localRecipeName.trim() || localIngredients.length === 0) {
        setSaveError('Recipe name and at least one ingredient are required');
        return;
      }

      setSaveError(null);

      try {
        if (editingRecipe && editingRecipe.id) {
          // Update existing recipe
          // Generate new tags based on updated recipe
          const updatedRecipeData: Omit<Recipe, 'id' | 'userId'> = {
            name: localRecipeName.trim(),
            cuisine: localCuisine,
            ingredients: localIngredients,
            notes: localRecipeNotes.trim() || undefined
          };
          const autoTags = generateRecipeTags(updatedRecipeData);
          const allTags = Array.from(new Set([...localRecipeTags, ...autoTags]));
          
          const updatedRecipe: Recipe = {
            id: editingRecipe.id,
            name: localRecipeName.trim(),
            cuisine: localCuisine,
            ingredients: localIngredients,
            userId: editingRecipe.userId,
            notes: localRecipeNotes.trim() || undefined,
            sharedWith: editingRecipe.sharedWith,
            tags: allTags.length > 0 ? allTags : undefined
          };
          
          // Update in Firestore
          const recipeRef: DocumentReference<DocumentData> = doc(db, collections.recipes, editingRecipe.id);
          
          // Build update object and remove undefined fields
          // Firestore doesn't allow undefined values - they must be omitted entirely
          const updateData: Record<string, any> = {
            name: localRecipeName.trim(),
            cuisine: localCuisine,
            ingredients: localIngredients,
            updatedAt: serverTimestamp()
          };
          
          // Only add notes if not empty
          const trimmedNotes = localRecipeNotes.trim();
          if (trimmedNotes) {
            updateData.notes = trimmedNotes;
          }
          
          // Only add tags if there are any
          if (allTags.length > 0) {
            updateData.tags = allTags;
          }
          
          await updateDoc(recipeRef, updateData);
          
          // Note: We don't manually update the recipes state here because
          // the Firestore real-time listener (onSnapshot) will automatically
          // detect the changes and update the state. This prevents sync issues.
          
          // Reset editing state
          setEditingRecipe(null);
          setSelectedRecipe(''); // Clear selection after update
        } else {
          // Save new recipe
          const recipe: Omit<Recipe, 'id' | 'userId'> = {
            name: localRecipeName.trim(),
            cuisine: localCuisine,
            ingredients: localIngredients,
            notes: localRecipeNotes.trim() || undefined
          };

          // Save with manual tags
          // Note: We don't manually update the recipes state here because
          // the Firestore real-time listener (onSnapshot) will automatically
          // detect the new recipe and update the state. This prevents duplicate entries.
          await saveRecipeToFirestore(recipe, localRecipeTags);
        }
        
        // Reset form but stay on Add New Recipe tab
        setLocalRecipeName('');
        setLocalCuisine('Misc');
        setLocalIngredient('');
        setLocalIngredients([]);
        setLocalRecipeNotes('');
        setLocalRecipeTags([]);
        setLocalTagInput('');
        setRecipeSaved(true);
        setSaveError(null);
        // Keep isAddingRecipe true since we're staying on the Add New Recipe tab
        
        // Hide success message after 3 seconds
        setTimeout(() => setRecipeSaved(false), 3000);
      } catch (error: any) {
        console.error('Error saving recipe:', error);
        setSaveError(error.message || 'Failed to save recipe. Please try again.');
        // Keep error visible for 5 seconds
        setTimeout(() => setSaveError(null), 5000);
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
      // Don't switch tabs - stay in current tab (My Recipes or Add New Recipe)
      // Don't set isAddingRecipe - we want to show the edit form in My Recipes tab
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
      setLocalRecipeNotes('');
      setLocalRecipeTags([]);
      setLocalTagInput('');
      setSelectedRecipe(''); // Clear recipe selection
      // Stay in current tab
    };

    /**
     * Handle Update My Recipe
     * 
     * This function updates a recipe selected in the My Recipes tab.
     */
    const handleUpdateMyRecipe = async () => {
      if (!selectedMyRecipe || !selectedMyRecipe.id) {
        setSaveError('No recipe selected');
        return;
      }

      if (!localRecipeName.trim() || localIngredients.length === 0) {
        setSaveError('Recipe name and at least one ingredient are required');
        return;
      }

      setSaveError(null);

      try {
        // Generate new tags based on updated recipe
        const updatedRecipeData: Omit<Recipe, 'id' | 'userId'> = {
          name: localRecipeName.trim(),
          cuisine: localCuisine,
          ingredients: localIngredients,
          notes: localRecipeNotes.trim() || undefined
        };
        const autoTags = generateRecipeTags(updatedRecipeData);
        const allTags = Array.from(new Set([...localRecipeTags, ...autoTags]));
        
        const updatedRecipe: Recipe = {
          id: selectedMyRecipe.id,
          name: localRecipeName.trim(),
          cuisine: localCuisine,
          ingredients: localIngredients,
          userId: selectedMyRecipe.userId,
          notes: localRecipeNotes.trim() || undefined,
          sharedWith: selectedMyRecipe.sharedWith,
          tags: allTags.length > 0 ? allTags : undefined
        };
        
        // Update in Firestore
        const recipeRef: DocumentReference<DocumentData> = doc(db, collections.recipes, selectedMyRecipe.id);
        
        // Build update object and remove undefined fields
        // Firestore doesn't allow undefined values - they must be omitted entirely
        const updateData: Record<string, any> = {
          name: localRecipeName.trim(),
          cuisine: localCuisine,
          ingredients: localIngredients,
          updatedAt: serverTimestamp()
        };
        
        // Only add notes if not empty
        const trimmedNotes = localRecipeNotes.trim();
        if (trimmedNotes) {
          updateData.notes = trimmedNotes;
        }
        
        // Only add tags if there are any
        if (allTags.length > 0) {
          updateData.tags = allTags;
        }
        
        await updateDoc(recipeRef, updateData);
        
        // Note: We don't manually update the recipes state here because
        // the Firestore real-time listener (onSnapshot) will automatically
        // detect the changes and update the state. This prevents sync issues.
        // We do update selectedMyRecipe so the UI reflects changes immediately
        setSelectedMyRecipe(updatedRecipe);
        
        setRecipeSaved(true);
        setSaveError(null);
        
        // Close the edit modal after successful update
        setIsEditModalOpen(false);
        
        // Hide success message after 3 seconds
        setTimeout(() => setRecipeSaved(false), 3000);
      } catch (error: any) {
        console.error('Error updating recipe:', error);
        setSaveError(error.message || 'Failed to update recipe. Please try again.');
        // Keep error visible for 5 seconds
        setTimeout(() => setSaveError(null), 5000);
      }
    };

    /**
     * Handle Cancel My Recipe Edit
     * 
     * This function cancels editing in the My Recipes tab and reloads the original recipe data.
     */
    const handleCancelMyRecipeEdit = () => {
      // Reload the original recipe data
      if (selectedMyRecipe) {
        setLocalRecipeName(selectedMyRecipe.name);
        setLocalCuisine(selectedMyRecipe.cuisine as Cuisine);
        setLocalIngredients(selectedMyRecipe.ingredients);
        setLocalRecipeNotes(selectedMyRecipe.notes || '');
        setLocalRecipeTags(selectedMyRecipe.tags || []);
        setLocalTagInput('');
        setSaveError(null);
      }
      // Close the modal
      setIsEditModalOpen(false);
    };

    // Get current user ID for filtering
    const currentUser = requireAuth();
    const userId = currentUser.uid;
    
    // Filter recipes based on view mode (My Recipes or Shared with Me)
    let viewRecipes = recipes;
    if (recipeViewMode === 'myRecipes') {
      // Show only recipes owned by the current user
      viewRecipes = recipes.filter(recipe => recipe.userId === userId);
    } else if (recipeViewMode === 'sharedWithMe') {
      // Show only recipes shared with the current user (not owned by them)
      viewRecipes = recipes.filter(recipe => 
        recipe.sharedWith && 
        recipe.sharedWith.includes(userId) && 
        recipe.userId !== userId
      );
    }

    // Filter recipes by selected cuisine
    const filteredRecipes = selectedCuisine
      ? viewRecipes.filter(recipe => recipe.cuisine === selectedCuisine)
      : viewRecipes;

    // Remove duplicates and sort filtered recipes alphabetically
    const sortedRecipes = deduplicateRecipes(filteredRecipes).sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div className="recipe-library">
        <div className="recipe-library-header">
          <h2>Recipe Library</h2>
          <button 
            className="chatbot-toggle-button"
            onClick={() => setIsChatbotOpen(true)}
            aria-label="Open chatbot"
          >
            👨‍🍳 Chat with Chef Coco
          </button>
        </div>
        
        {/* Recipe Library Sub-Tabs */}
        <div className="recipe-library-tabs">
          <button
            className={`recipe-library-tab ${recipeViewMode === 'addNewRecipe' ? 'active' : ''}`}
            onClick={() => {
              setRecipeViewMode('addNewRecipe');
              setSelectedRecipe(''); // Clear selection when switching tabs
              setEditingRecipe(null); // Clear editing state
            }}
          >
            Add New Recipe
          </button>
          <button
            className={`recipe-library-tab ${recipeViewMode === 'myRecipes' ? 'active' : ''}`}
            onClick={() => {
              setRecipeViewMode('myRecipes');
              setSelectedMyRecipe(null); // Clear selected recipe when switching tabs
              setSelectedCuisine(''); // Reset cuisine filter
              setSelectedSharedRecipe(null); // Clear shared recipe selection
              setSelectedSharedCuisine(''); // Clear shared cuisine filter
            }}
          >
            My Recipes
          </button>
          <button
            className={`recipe-library-tab ${recipeViewMode === 'sharedWithMe' ? 'active' : ''}`}
            onClick={() => {
              setRecipeViewMode('sharedWithMe');
              setSelectedRecipe(''); // Clear selection when switching tabs
              setEditingRecipe(null); // Clear editing state
              setSelectedSharedRecipe(null); // Clear shared recipe selection
              setSelectedSharedCuisine(''); // Clear shared cuisine filter
              setSelectedSharedBy(''); // Clear shared by filter
              setSelectedSharedTag(''); // Clear tags filter
            }}
          >
            Shared with Me
          </button>
        </div>
        
        {/* Add New Recipe Tab Content */}
        {recipeViewMode === 'addNewRecipe' && (
          <div className="add-new-recipe-tab-content">
            {/* Only show form in Add New Recipe tab when NOT editing (editing should happen in My Recipes tab) */}
            {isAddingRecipe && !editingRecipe ? (
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

                {/* Recipe Notes Field */}
                <div className="form-group">
                  <label htmlFor="recipe-notes">Notes (optional):</label>
                  <textarea
                    id="recipe-notes"
                    value={localRecipeNotes}
                    onChange={(e) => setLocalRecipeNotes(e.target.value)}
                    placeholder="Add personal notes about this recipe..."
                    className="recipe-notes-textarea"
                    rows={4}
                  />
                  <small className="form-help-text">
                    Add your own notes, tips, or modifications for this recipe
                  </small>
                </div>

                {/* Manual Tags Field */}
                <div className="form-group">
                  <label htmlFor="recipe-tags">Tags (optional):</label>
                  
                  {/* Tag Suggestions - Quick add buttons organized by category */}
                  <div className="tag-suggestions-container">
                    <div className="tag-suggestions-section">
                      <span className="tag-suggestions-label">Dietary:</span>
                      <div className="tag-suggestions-bubbles">
                        {TAG_SUGGESTIONS.dietary.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className={`tag-suggestion-bubble ${localRecipeTags.includes(tag) ? 'tag-suggestion-added' : ''}`}
                            onClick={() => handleAddSuggestedTag(tag)}
                            disabled={localRecipeTags.includes(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="tag-suggestions-section">
                      <span className="tag-suggestions-label">Cooking:</span>
                      <div className="tag-suggestions-bubbles">
                        {TAG_SUGGESTIONS.cooking_methods.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className={`tag-suggestion-bubble ${localRecipeTags.includes(tag) ? 'tag-suggestion-added' : ''}`}
                            onClick={() => handleAddSuggestedTag(tag)}
                            disabled={localRecipeTags.includes(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="tag-suggestions-section">
                      <span className="tag-suggestions-label">Meal Type:</span>
                      <div className="tag-suggestions-bubbles">
                        {TAG_SUGGESTIONS.meal_types.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className={`tag-suggestion-bubble ${localRecipeTags.includes(tag) ? 'tag-suggestion-added' : ''}`}
                            onClick={() => handleAddSuggestedTag(tag)}
                            disabled={localRecipeTags.includes(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="tag-suggestions-section">
                      <span className="tag-suggestions-label">Complexity:</span>
                      <div className="tag-suggestions-bubbles">
                        {TAG_SUGGESTIONS.complexity.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className={`tag-suggestion-bubble ${localRecipeTags.includes(tag) ? 'tag-suggestion-added' : ''}`}
                            onClick={() => handleAddSuggestedTag(tag)}
                            disabled={localRecipeTags.includes(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="tag-input-group">
                    <input
                      type="text"
                      id="recipe-tags"
                      value={localTagInput}
                      onChange={(e) => setLocalTagInput(e.target.value)}
                      placeholder="Enter a tag (e.g., quick, spicy, vegetarian)"
                      className="recipe-input"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddLocalTag()}
                    />
                    <button 
                      className="add-tag-button"
                      onClick={handleAddLocalTag}
                      disabled={!localTagInput.trim() || localRecipeTags.includes(localTagInput.trim().toLowerCase())}
                    >
                      Add Tag
                    </button>
                  </div>
                  {localRecipeTags.length > 0 && (
                    <div className="tags-list">
                      <h4>Tags:</h4>
                      <div className="tags-container">
                        {localRecipeTags.map((tag, index) => (
                          <span key={index} className="tag-item">
                            {tag}
                            <button 
                              className="remove-tag-button"
                              onClick={() => handleRemoveLocalTag(index)}
                              aria-label={`Remove tag ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <small className="form-help-text">
                    Add custom tags to categorize your recipe. Tags are combined with auto-generated tags.
                  </small>
                </div>

                {/* Error Message */}
                {saveError && (
                  <div className="error-message" role="alert">
                    ❌ {saveError}
                  </div>
                )}

                {/* Form Buttons - Always visible, button is disabled when form is invalid */}
                <div className="form-buttons">
                  <button 
                    className={`save-recipe-button ${localRecipeName.trim() && localIngredients.length > 0 ? 'enabled' : 'disabled'}`}
                    onClick={handleSaveLocalRecipe}
                    disabled={!localRecipeName.trim() || localIngredients.length === 0}
                    type="button"
                    title={localRecipeName.trim() && localIngredients.length > 0 ? 'Click to save recipe' : 'Enter recipe name and at least one ingredient to enable'}
                  >
                    Save Recipe
                  </button>
                  <button 
                    className="cancel-button"
                    onClick={() => {
                      setLocalRecipeName('');
                      setLocalCuisine('Misc');
                      setLocalIngredient('');
                      setLocalIngredients([]);
                      setLocalRecipeNotes('');
                      setLocalRecipeTags([]);
                      setLocalTagInput('');
                      setSaveError(null);
                      setIsAddingRecipe(false);
                    }}
                    type="button"
                  >
                    Clear Form
                  </button>
                </div>
                
                {/* Show validation message if form is invalid */}
                {(!localRecipeName.trim() || localIngredients.length === 0) && (
                  <div className="form-validation-message">
                    <small>Please enter a recipe name and at least one ingredient to save.</small>
                  </div>
                )}
              </div>
            ) : (
              <div className="add-recipe-prompt">
                <p>Fill out the form above to add a new recipe to your library.</p>
              </div>
            )}

            {recipeSaved && (
              <div className="recipe-saved-message" role="alert">
                ✅ Recipe saved successfully!
              </div>
            )}
          </div>
        )}

        {/* My Recipes Tab Content */}
        {recipeViewMode === 'myRecipes' && (() => {
          // Get current user ID and email for filtering and display
          const currentUser = requireAuth();
          const userId = currentUser.uid;
          const userEmail = currentUser.email || 'Unknown email';
          
          // Filter recipes to show only those created by the logged in user
          const userRecipes = recipes.filter(recipe => recipe.userId === userId);
          
          // Filter by selected cuisine (if a cuisine is selected)
          // If no cuisine is selected (empty string), show all recipes
          const filteredByCuisine = selectedCuisine
            ? userRecipes.filter(recipe => recipe.cuisine === selectedCuisine)
            : userRecipes;
          
          // Remove duplicates and sort recipes alphabetically by name
          const sortedUserRecipes = deduplicateRecipes(filteredByCuisine).sort((a, b) => 
            a.name.localeCompare(b.name)
          );
          
          return (
            <div className="my-recipes-tab-content">
              {/* Cuisine Filter Dropdown */}
              <div className="recipe-filters">
                <div className="cuisine-filter">
                  <label htmlFor="my-recipes-cuisine-filter">Filter by Cuisine:</label>
                  <SearchableDropdown
                    id="my-recipes-cuisine-filter"
                    value={selectedCuisine}
                    options={CUISINES.map((cuisine) => ({ value: cuisine, label: cuisine }))}
                    onChange={(value) => {
                      setSelectedCuisine(value as Cuisine | '');
                      // Clear selected recipe when filter changes
                      setSelectedMyRecipe(null);
                    }}
                    className="cuisine-dropdown searchable-dropdown-input"
                    emptyOptionLabel="All Cuisines"
                    placeholder="Type cuisine or choose from list..."
                  />
                </div>
              </div>
              
              {/* Recipe Selection Dropdown */}
              <div className="recipe-selection">
                <label htmlFor="my-recipes-dropdown">Select Recipe:</label>
                <SearchableDropdown
                  id="my-recipes-dropdown" 
                  value={selectedMyRecipe?.id || ''} 
                  options={sortedUserRecipes.map((recipe) => ({
                    value: recipe.id || '',
                    label: recipe.name
                  }))}
                  onChange={(recipeId) => {
                    if (recipeId) {
                      const recipe = sortedUserRecipes.find(r => r.id === recipeId);
                      setSelectedMyRecipe(recipe || null);
                    } else {
                      setSelectedMyRecipe(null);
                    }
                  }}
                  className="recipe-dropdown searchable-dropdown-input"
                  emptyOptionLabel="Choose a recipe..."
                  placeholder="Type recipe name or choose from list..."
                />
              </div>
              
              {/* Recipe Details View - Shows when a recipe is selected */}
              {selectedMyRecipe && !isEditModalOpen && (
                <div className="recipe-details-view">
                  <div className="recipe-details-header">
                    <h2 className="recipe-details-title">{selectedMyRecipe.name}</h2>
                    <div className="recipe-details-actions">
                      <button 
                        className="share-recipe-button"
                        onClick={() => setIsShareModalOpen(true)}
                        type="button"
                        title="Share this recipe with other users"
                      >
                        <svg className="share-recipe-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3"></circle>
                          <circle cx="6" cy="12" r="3"></circle>
                          <circle cx="18" cy="19" r="3"></circle>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        Share Recipe
                      </button>
                      <button 
                        className="edit-recipe-button"
                        onClick={() => setIsEditModalOpen(true)}
                        type="button"
                      >
                        ✏️ Edit Recipe
                      </button>
                    </div>
                  </div>
                  
                  <div className="recipe-details-content">
                    {/* Cuisine Badge */}
                    <div className="recipe-detail-section">
                      <span className="recipe-detail-label">Cuisine:</span>
                      <span className="recipe-cuisine-badge">{selectedMyRecipe.cuisine}</span>
                    </div>
                    
                    {/* Ingredients */}
                    <div className="recipe-detail-section">
                      <h3 className="recipe-section-title">Ingredients</h3>
                      {selectedMyRecipe.ingredients && selectedMyRecipe.ingredients.length > 0 ? (
                        <ul className="recipe-ingredients-list">
                          {selectedMyRecipe.ingredients.map((ingredient, index) => (
                            <li key={index} className="recipe-ingredient-item">
                              {ingredient}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="no-data-message">No ingredients listed</p>
                      )}
                    </div>
                    
                    {/* Notes */}
                    {selectedMyRecipe.notes && (
                      <div className="recipe-detail-section">
                        <h3 className="recipe-section-title">Notes</h3>
                        <div className="recipe-notes-display">
                          {selectedMyRecipe.notes}
                        </div>
                      </div>
                    )}
                    
                    {/* Tags */}
                    {selectedMyRecipe.tags && selectedMyRecipe.tags.length > 0 && (
                      <div className="recipe-detail-section">
                        <h3 className="recipe-section-title">Tags</h3>
                        <div className="recipe-tags-display">
                          {selectedMyRecipe.tags.map((tag, index) => (
                            <span key={index} className="recipe-tag-badge">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Created By - Automated and uneditable */}
                    <div className="recipe-detail-section">
                      <span className="recipe-detail-label">Created By:</span>
                      <div className="created-by-display">
                        <span className="created-by-email">{userEmail}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Edit Modal - Full page centered modal */}
              {isEditModalOpen && selectedMyRecipe && (
                <div className="edit-recipe-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
                  <div className="edit-recipe-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="edit-recipe-modal-header">
                      <h2>Edit Recipe</h2>
                      <button 
                        className="close-modal-button"
                        onClick={() => {
                          setIsEditModalOpen(false);
                          handleCancelMyRecipeEdit();
                        }}
                        type="button"
                        aria-label="Close modal"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="edit-recipe-modal-body">
                      <div className="new-recipe-form">
                  
                  {/* Recipe Name */}
                  <div className="form-group">
                    <label htmlFor="my-recipe-name">Recipe Name:</label>
                    <input
                      type="text"
                      id="my-recipe-name"
                      value={localRecipeName}
                      onChange={(e) => setLocalRecipeName(e.target.value)}
                      placeholder="Enter recipe name"
                      className="recipe-input"
                    />
                  </div>
                  
                  {/* Cuisine */}
                  <div className="form-group">
                    <label htmlFor="my-recipe-cuisine">Cuisine:</label>
                    <select
                      id="my-recipe-cuisine"
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
                  
                  {/* Add Ingredient */}
                  <div className="form-group">
                    <label htmlFor="my-recipe-new-ingredient">Add Ingredient:</label>
                    <div className="ingredient-input-group">
                      <input
                        type="text"
                        id="my-recipe-new-ingredient"
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
                  
                  {/* Recipe Notes Field */}
                  <div className="form-group">
                    <label htmlFor="my-recipe-notes">Notes (optional):</label>
                    <textarea
                      id="my-recipe-notes"
                      value={localRecipeNotes}
                      onChange={(e) => setLocalRecipeNotes(e.target.value)}
                      placeholder="Add personal notes about this recipe..."
                      className="recipe-notes-textarea"
                      rows={4}
                    />
                    <small className="form-help-text">
                      Add your own notes, tips, or modifications for this recipe
                    </small>
                  </div>
                  
                  {/* Manual Tags Field */}
                  <div className="form-group">
                    <label htmlFor="my-recipe-tags">Tags (optional):</label>
                    
                    {/* Tag Suggestions - Quick add buttons organized by category */}
                    <div className="tag-suggestions-container">
                      <div className="tag-suggestions-section">
                        <span className="tag-suggestions-label">Dietary:</span>
                        <div className="tag-suggestions-bubbles">
                          {TAG_SUGGESTIONS.dietary.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className={`tag-suggestion-bubble ${localRecipeTags.includes(tag) ? 'tag-suggestion-added' : ''}`}
                              onClick={() => handleAddSuggestedTag(tag)}
                              disabled={localRecipeTags.includes(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="tag-suggestions-section">
                        <span className="tag-suggestions-label">Cooking:</span>
                        <div className="tag-suggestions-bubbles">
                          {TAG_SUGGESTIONS.cooking_methods.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className={`tag-suggestion-bubble ${localRecipeTags.includes(tag) ? 'tag-suggestion-added' : ''}`}
                              onClick={() => handleAddSuggestedTag(tag)}
                              disabled={localRecipeTags.includes(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="tag-suggestions-section">
                        <span className="tag-suggestions-label">Meal Type:</span>
                        <div className="tag-suggestions-bubbles">
                          {TAG_SUGGESTIONS.meal_types.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className={`tag-suggestion-bubble ${localRecipeTags.includes(tag) ? 'tag-suggestion-added' : ''}`}
                              onClick={() => handleAddSuggestedTag(tag)}
                              disabled={localRecipeTags.includes(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="tag-suggestions-section">
                        <span className="tag-suggestions-label">Complexity:</span>
                        <div className="tag-suggestions-bubbles">
                          {TAG_SUGGESTIONS.complexity.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className={`tag-suggestion-bubble ${localRecipeTags.includes(tag) ? 'tag-suggestion-added' : ''}`}
                              onClick={() => handleAddSuggestedTag(tag)}
                              disabled={localRecipeTags.includes(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="tag-input-group">
                      <input
                        type="text"
                        id="my-recipe-tags"
                        value={localTagInput}
                        onChange={(e) => setLocalTagInput(e.target.value)}
                        placeholder="Enter a tag (e.g., quick, spicy, vegetarian)"
                        className="recipe-input"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddLocalTag()}
                      />
                      <button 
                        className="add-tag-button"
                        onClick={handleAddLocalTag}
                        disabled={!localTagInput.trim() || localRecipeTags.includes(localTagInput.trim().toLowerCase())}
                      >
                        Add Tag
                      </button>
                    </div>
                    {localRecipeTags.length > 0 && (
                      <div className="tags-list">
                        <h4>Tags:</h4>
                        <div className="tags-container">
                          {localRecipeTags.map((tag, index) => (
                            <span key={index} className="tag-item">
                              {tag}
                              <button 
                                className="remove-tag-button"
                                onClick={() => handleRemoveLocalTag(index)}
                                aria-label={`Remove tag ${tag}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <small className="form-help-text">
                      Add custom tags to categorize your recipe. Tags are combined with auto-generated tags.
                    </small>
                  </div>
                  
                  {/* Created By - Automated and uneditable */}
                  <div className="form-group">
                    <label htmlFor="my-recipe-created-by">Created By:</label>
                    <input
                      type="email"
                      id="my-recipe-created-by"
                      value={userEmail}
                      readOnly
                      className="recipe-input created-by-input"
                      disabled
                    />
                    <small className="form-help-text">
                      This field is automatically set and cannot be edited
                    </small>
                  </div>
                  
                  {/* Error Message */}
                  {saveError && (
                    <div className="error-message" role="alert">
                      ❌ {saveError}
                    </div>
                  )}
                  
                  {/* Form Buttons */}
                  <div className="form-buttons">
                    <button 
                      className={`save-recipe-button ${localRecipeName.trim() && localIngredients.length > 0 ? 'enabled' : 'disabled'}`}
                      onClick={handleUpdateMyRecipe}
                      disabled={!localRecipeName.trim() || localIngredients.length === 0}
                      type="button"
                      title={localRecipeName.trim() && localIngredients.length > 0 ? 'Click to update recipe' : 'Enter recipe name and at least one ingredient to enable'}
                    >
                      Update Recipe
                    </button>
                    <button 
                      className="cancel-button"
                      onClick={handleCancelMyRecipeEdit}
                      type="button"
                    >
                      Cancel Edit
                    </button>
                  </div>
                  
                        {/* Show validation message if form is invalid */}
                        {(!localRecipeName.trim() || localIngredients.length === 0) && (
                          <div className="form-validation-message">
                            <small>Please enter a recipe name and at least one ingredient to save.</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Success Message */}
              {recipeSaved && selectedMyRecipe && !isEditModalOpen && (
                <div className="recipe-saved-message" role="alert">
                  ✅ Recipe updated successfully!
                </div>
              )}
              
              {/* Empty State Message */}
              {sortedUserRecipes.length === 0 && (
                <div className="empty-state-message">
                  <p>
                    {selectedCuisine 
                      ? `You don't have any ${selectedCuisine} recipes yet.` 
                      : "You don't have any recipes yet."}
                  </p>
                  <p>Go to the "Add New Recipe" tab to create your first recipe!</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Shared with Me Tab Content */}
        {recipeViewMode === 'sharedWithMe' && (() => {
          // Get current user ID for filtering
          const currentUser = requireAuth();
          const userId = currentUser.uid;
          
          // Filter recipes to show only those shared with the current user (not owned by them)
          let sharedRecipes = recipes.filter(recipe => 
            recipe.sharedWith && 
            recipe.sharedWith.includes(userId) && 
            recipe.userId !== userId
          );
          
          // Get unique owner IDs and tags for filter options
          const uniqueOwnerIds = Array.from(new Set(sharedRecipes.map(recipe => recipe.userId)));
          const allTags = sharedRecipes.flatMap(recipe => recipe.tags || []);
          const uniqueTags = Array.from(new Set(allTags)).sort();
          
          // Apply filters: Shared By filter
          if (selectedSharedBy) {
            sharedRecipes = sharedRecipes.filter(recipe => recipe.userId === selectedSharedBy);
          }

          // Apply filters: Cuisine filter
          if (selectedSharedCuisine) {
            sharedRecipes = sharedRecipes.filter(recipe => recipe.cuisine === selectedSharedCuisine);
          }
          
          // Apply filters: Tags filter
          if (selectedSharedTag) {
            sharedRecipes = sharedRecipes.filter(recipe => 
              recipe.tags && recipe.tags.includes(selectedSharedTag)
            );
          }
          
          // Remove duplicates and sort recipes alphabetically by name
          const sortedSharedRecipes = deduplicateRecipes(sharedRecipes).sort((a, b) => 
            a.name.localeCompare(b.name)
          );

          // Cuisine options for shared recipes filter
          const uniqueSharedCuisines = Array.from(
            new Set(
              recipes
                .filter(recipe =>
                  recipe.sharedWith &&
                  recipe.sharedWith.includes(userId) &&
                  recipe.userId !== userId
                )
                .map(recipe => recipe.cuisine)
            )
          ).sort();
          
          return (
            <div className="shared-recipes-tab-content">
              {/* Filters Container - Responsive inline filters */}
              <div className="shared-recipes-filters">
                {/* Cuisine Filter */}
                <div className="filter-group">
                  <label htmlFor="shared-cuisine-filter">Filter by Cuisine:</label>
                  <SearchableDropdown
                    id="shared-cuisine-filter"
                    value={selectedSharedCuisine}
                    options={uniqueSharedCuisines.map((cuisine) => ({ value: cuisine, label: cuisine }))}
                    onChange={(value) => {
                      setSelectedSharedCuisine(value as Cuisine | '');
                      setSelectedSharedRecipe(null); // Clear selection when filter changes
                    }}
                    className="cuisine-dropdown searchable-dropdown-input"
                    emptyOptionLabel="All Cuisines"
                    placeholder="Type cuisine or choose from list..."
                  />
                </div>

                {/* Recipe Selection Dropdown */}
                <div className="filter-group">
                  <label htmlFor="shared-recipes-dropdown">Select Recipe:</label>
                  <SearchableDropdown
                    id="shared-recipes-dropdown" 
                    value={selectedSharedRecipe?.id || ''} 
                    options={sortedSharedRecipes.map((recipe) => ({
                      value: recipe.id || '',
                      label: recipe.name
                    }))}
                    onChange={(recipeId) => {
                      if (recipeId) {
                        const recipe = sortedSharedRecipes.find(r => r.id === recipeId);
                        setSelectedSharedRecipe(recipe || null);
                      } else {
                        setSelectedSharedRecipe(null);
                      }
                    }}
                    className="recipe-dropdown searchable-dropdown-input"
                    emptyOptionLabel="Choose a recipe..."
                    placeholder="Type recipe name or choose from list..."
                  />
                </div>
                
                {/* Shared By Filter */}
                <div className="filter-group">
                  <label htmlFor="shared-by-filter">Shared By:</label>
                  <select
                    id="shared-by-filter"
                    value={selectedSharedBy}
                    onChange={(e) => {
                      setSelectedSharedBy(e.target.value);
                      setSelectedSharedRecipe(null); // Clear selection when filter changes
                    }}
                    className="recipe-dropdown"
                  >
                    <option value="">All Users</option>
                    {uniqueOwnerIds.map((ownerId) => (
                      <option key={ownerId} value={ownerId}>
                        {sharedRecipeUserEmails[ownerId] || 'Loading...'}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Tags Filter */}
                <div className="filter-group">
                  <label htmlFor="tags-filter">Tags:</label>
                  <select
                    id="tags-filter"
                    value={selectedSharedTag}
                    onChange={(e) => {
                      setSelectedSharedTag(e.target.value);
                      setSelectedSharedRecipe(null); // Clear selection when filter changes
                    }}
                    className="recipe-dropdown"
                  >
                    <option value="">All Tags</option>
                    {uniqueTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Recipe Details View - Shows when a recipe is selected (Read-only) */}
              {selectedSharedRecipe && (
                <SharedRecipeDetails recipe={selectedSharedRecipe} />
              )}
              
              {/* Empty State Message */}
              {sortedSharedRecipes.length === 0 && (
                <div className="empty-state-message">
                  <p>You don't have any shared recipes yet.</p>
                  <p>Ask other users to share their recipes with you!</p>
                </div>
              )}
            </div>
          );
        })()}
        
        {/* Share Recipe Modal */}
        <ShareRecipeModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          recipe={selectedMyRecipe}
          currentUser={user}
        />
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
    const [categorizing, setCategorizing] = useState(false);
    const [miscItem, setMiscItem] = useState('');
    const [miscItems, setMiscItems] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'shopping' | 'overview'>('shopping');
    // Add checkedItems state for this component
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
    // Add categorized ingredients state
    const [categorizedIngredients, setCategorizedIngredients] = useState<CategorizedIngredients>({});
    const [remoteUpdatedItems, setRemoteUpdatedItems] = useState<Set<string>>(new Set());
    const scrollPositionRef = useRef<number>(0);
    const localMutationRef = useRef(false);
    const localMutationTimeoutRef = useRef<number | null>(null);
    const remoteHighlightTimeoutRef = useRef<number | null>(null);
    const currentIngredientsHashRef = useRef<string>('');
    const previousCheckedItemsRef = useRef<Set<string>>(new Set());
    const previousMiscItemsRef = useRef<string[]>([]);

    const markLocalMutation = () => {
      localMutationRef.current = true;
      if (localMutationTimeoutRef.current) {
        window.clearTimeout(localMutationTimeoutRef.current);
      }
      localMutationTimeoutRef.current = window.setTimeout(() => {
        localMutationRef.current = false;
      }, 500);
    };

    useEffect(() => {
      let ticking = false;
      const handleScroll = () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            scrollPositionRef.current = window.scrollY;
            ticking = false;
          });
          ticking = true;
        }
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Load ingredients, misc items, checked items, and categorized ingredients when week selection or recipes change
    // This ensures the shopping list updates when recipes are loaded or updated
    useEffect(() => {
      let isActive = true;
      let unsubscribeShoppingList: (() => void) | null = null;

      const loadItems = async () => {
        if (!selectedWeek) {
          setIngredients([]);
          setMiscItems([]);
          setCheckedItems(new Set());
          setCategorizedIngredients({});
          setRemoteUpdatedItems(new Set());
          currentIngredientsHashRef.current = '';
          previousCheckedItemsRef.current = new Set();
          previousMiscItemsRef.current = [];
          return;
        }

        setLoading(true);
        try {
          const aggregatedIngredients = await getAggregatedIngredients();
          if (!isActive) return;
          setIngredients(aggregatedIngredients);
          
          const currentHash = calculateIngredientsHash(aggregatedIngredients);
          currentIngredientsHashRef.current = currentHash;

          // Shopping list sharing note:
          // With the current {userId}_{selectedWeek} key format, real-time sharing across
          // separate accounts is not possible unless both devices authenticate as the same user.
          const currentUser = requireAuth();
          const userId = currentUser.uid;
          const docId = `${userId}_${selectedWeek}`;
          const shoppingListRef = doc(db, collections.shoppingLists, docId);

          let didInitializeCategorization = false;
          unsubscribeShoppingList = onSnapshot(shoppingListRef, async (snapshot) => {
            if (!isActive) return;
            const data = snapshot.exists() ? snapshot.data() : {};

            if (!didInitializeCategorization) {
              didInitializeCategorization = true;
              if (snapshot.exists()) {
                const cachedHash = data.ingredientsHash;
                const cachedCategorized = data.categorizedIngredients;

                if (cachedHash === currentHash && cachedCategorized) {
                  console.log('[Shopping List] Using cached categorization');
                  setCategorizedIngredients(cachedCategorized);
                } else if (aggregatedIngredients.length > 0) {
                  console.log('[Shopping List] Categorizing ingredients with Gemini AI');
                  setCategorizing(true);
                  try {
                    const categorized = await categorizeIngredientsWithGemini(aggregatedIngredients);
                    if (!isActive) return;
                    setCategorizedIngredients(categorized);

                    await setDoc(shoppingListRef, {
                      categorizedIngredients: categorized,
                      ingredientsHash: currentHash,
                      weekRange: selectedWeek,
                      userId: userId
                    }, { merge: true });
                    console.log('[Shopping List] Saved categorized ingredients to Firestore');
                  } catch (error) {
                    console.error('Error categorizing ingredients:', error);
                    setCategorizedIngredients({});
                  } finally {
                    if (isActive) {
                      setCategorizing(false);
                    }
                  }
                } else {
                  setCategorizedIngredients({});
                }
              } else {
                setMiscItems([]);
                setCheckedItems(new Set());
                previousCheckedItemsRef.current = new Set();
                previousMiscItemsRef.current = [];

                if (aggregatedIngredients.length > 0) {
                  console.log('[Shopping List] First time categorizing ingredients');
                  setCategorizing(true);
                  try {
                    const categorized = await categorizeIngredientsWithGemini(aggregatedIngredients);
                    if (!isActive) return;
                    setCategorizedIngredients(categorized);

                    await setDoc(shoppingListRef, {
                      categorizedIngredients: categorized,
                      ingredientsHash: currentHash,
                      miscItems: [],
                      checkedItems: [],
                      weekRange: selectedWeek,
                      userId: userId
                    }, { merge: true });
                    console.log('[Shopping List] Saved categorized ingredients to Firestore');
                  } catch (error) {
                    console.error('Error categorizing ingredients:', error);
                    setCategorizedIngredients({});
                  } finally {
                    if (isActive) {
                      setCategorizing(false);
                    }
                  }
                } else {
                  setCategorizedIngredients({});
                }
              }
              if (isActive) {
                setLoading(false);
              }
            }

            if (!snapshot.exists()) return;

            // Guard: if ingredients hash changed, meal-plan sync should drive full reload.
            // We skip checked/misc sync here to avoid double-processing and recategorization loops.
            if (data.ingredientsHash !== currentIngredientsHashRef.current) return;

            const savedScroll = scrollPositionRef.current;
            const incomingCheckedItems = new Set<string>(Array.isArray(data.checkedItems) ? data.checkedItems : []);
            const incomingMiscItems = Array.isArray(data.miscItems) ? data.miscItems : [];

            if (!localMutationRef.current) {
              const changedItems = new Set<string>();
              const previousCheckedItems = previousCheckedItemsRef.current;
              const previousMiscItems = previousMiscItemsRef.current;

              const checkedCandidates = new Set<string>([
                ...Array.from(previousCheckedItems),
                ...Array.from(incomingCheckedItems)
              ]);
              checkedCandidates.forEach((itemName) => {
                if (previousCheckedItems.has(itemName) !== incomingCheckedItems.has(itemName)) {
                  changedItems.add(itemName);
                }
              });

              const previousMiscSet = new Set(previousMiscItems);
              const incomingMiscSet = new Set(incomingMiscItems);
              const miscCandidates = new Set<string>([
                ...Array.from(previousMiscSet),
                ...Array.from(incomingMiscSet)
              ]);
              miscCandidates.forEach((itemName) => {
                if (previousMiscSet.has(itemName) !== incomingMiscSet.has(itemName)) {
                  changedItems.add(itemName);
                }
              });

              if (changedItems.size > 0) {
                setRemoteUpdatedItems(changedItems);
                if (remoteHighlightTimeoutRef.current) {
                  window.clearTimeout(remoteHighlightTimeoutRef.current);
                }
                remoteHighlightTimeoutRef.current = window.setTimeout(() => {
                  setRemoteUpdatedItems(new Set());
                }, 800);
              }
            }

            setCheckedItems(incomingCheckedItems);
            setMiscItems(incomingMiscItems);
            previousCheckedItemsRef.current = incomingCheckedItems;
            previousMiscItemsRef.current = incomingMiscItems;

            requestAnimationFrame(() => {
              window.scrollTo({ top: savedScroll, behavior: 'instant' as ScrollBehavior });
            });
          }, (error) => {
            console.error('Error subscribing to shopping list updates:', error);
            if (isActive) {
              setLoading(false);
            }
          });
        } catch (error) {
          console.error('Error loading items:', error);
          setIngredients([]);
          setMiscItems([]);
          setCheckedItems(new Set());
          setCategorizedIngredients({});
          setLoading(false);
        }
      };

      loadItems();

      return () => {
        isActive = false;
        if (unsubscribeShoppingList) {
          unsubscribeShoppingList();
        }
      };
    }, [selectedWeek, recipes.length]); // Include recipes.length to refresh when recipes change

    useEffect(() => {
      return () => {
        if (localMutationTimeoutRef.current) {
          window.clearTimeout(localMutationTimeoutRef.current);
        }
        if (remoteHighlightTimeoutRef.current) {
          window.clearTimeout(remoteHighlightTimeoutRef.current);
        }
      };
    }, []);

    const getShoppingItemRowClassName = (itemName: string) => {
      const classNames: string[] = [];
      if (checkedItems.has(itemName)) {
        classNames.push('checked');
      }
      if (remoteUpdatedItems.has(itemName)) {
        classNames.push('remote-updated');
      }
      return classNames.join(' ');
    };

    // Handler for toggling checked state of an item
    const handleToggleCheckedItem = async (item: string) => {
      // Update local state immediately for responsive UI
      setCheckedItems(prev => {
        const newChecked = new Set(prev);
        if (newChecked.has(item)) {
          newChecked.delete(item);
        } else {
          newChecked.add(item);
        }
        previousCheckedItemsRef.current = newChecked;

        // Save to Firestore in the background (user-specific)
        if (selectedWeek) {
          try {
            const currentUser = requireAuth();
            const userId = currentUser.uid;
            const docId = `${userId}_${selectedWeek}`;
            const shoppingListRef = doc(db, collections.shoppingLists, docId);
            markLocalMutation();
            setDoc(shoppingListRef, {
              checkedItems: Array.from(newChecked),
              weekRange: selectedWeek,
              userId: userId
            }, { merge: true })
              .then(() => {
                secureLog(`[Shopping List] Updated checked items for week ${selectedWeek}`);
              })
              .catch((error) => {
                secureError('[Shopping List] Error saving checked items:', error);
                setCheckedItems(currentCheckedItems => {
                  const revertedChecked = new Set(currentCheckedItems);
                  if (revertedChecked.has(item)) {
                    revertedChecked.delete(item);
                  } else {
                    revertedChecked.add(item);
                  }
                  previousCheckedItemsRef.current = revertedChecked;
                  return revertedChecked;
                });
              });
          } catch (error) {
            secureError('[Shopping List] Error saving checked items:', error);
          }
        }
        return newChecked;
      });
    };

    const handleAddMiscItem = () => {
      if (!miscItem.trim() || !selectedWeek) return;

      const itemToAdd = miscItem.trim();
      const previousMiscItems = miscItems;
      const newMiscItems = [...miscItems, itemToAdd];
      setMiscItems(newMiscItems);
      previousMiscItemsRef.current = newMiscItems;
      setMiscItem('');

      try {
        const currentUser = requireAuth();
        const userId = currentUser.uid;

        // Save to Firestore (user-specific)
        const docId = `${userId}_${selectedWeek}`;
        const shoppingListRef = doc(db, collections.shoppingLists, docId);
        markLocalMutation();
        setDoc(shoppingListRef, {
          miscItems: newMiscItems,
          weekRange: selectedWeek,
          userId: userId
        }, { merge: true }).catch((error) => {
          console.error('Error adding misc item:', error);
          setMiscItems(previousMiscItems);
          previousMiscItemsRef.current = previousMiscItems;
          setMiscItem(itemToAdd);
        });
      } catch (error) {
        console.error('Error adding misc item:', error);
        setMiscItems(previousMiscItems);
        previousMiscItemsRef.current = previousMiscItems;
        setMiscItem(itemToAdd);
      }
    };

    const handleRemoveMiscItem = (index: number) => {
      if (!selectedWeek) return;

      const previousMiscItems = miscItems;
      const newMiscItems = miscItems.filter((_, i) => i !== index);
      setMiscItems(newMiscItems);
      previousMiscItemsRef.current = newMiscItems;

      try {
        const currentUser = requireAuth();
        const userId = currentUser.uid;

        // Update Firestore (user-specific)
        const docId = `${userId}_${selectedWeek}`;
        const shoppingListRef = doc(db, collections.shoppingLists, docId);
        markLocalMutation();
        setDoc(shoppingListRef, {
          miscItems: newMiscItems,
          weekRange: selectedWeek,
          userId: userId
        }, { merge: true }).catch((error) => {
          console.error('Error removing misc item:', error);
          setMiscItems(previousMiscItems);
          previousMiscItemsRef.current = previousMiscItems;
        });
      } catch (error) {
        console.error('Error removing misc item:', error);
        setMiscItems(previousMiscItems);
        previousMiscItemsRef.current = previousMiscItems;
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

                {loading || categorizing ? (
                  <p>{categorizing ? 'Categorizing ingredients...' : 'Loading items...'}</p>
                ) : (
                  <>
                    {/* Recipe Ingredients List - Grouped by Category */}
                    {ingredients.length > 0 && (
                      <div className="recipe-ingredients-section">
                        <h4>Recipe Ingredients</h4>
                        {Object.keys(categorizedIngredients).length > 0 ? (
                          // Display grouped by category
                          Object.entries(categorizedIngredients).map(([category, items]) => (
                            <div key={category} className="ingredient-category-group">
                              <h5 className="category-header">
                                {items[0]?.emoji || '🏺'} {category}
                              </h5>
                              <ul className="category-ingredients-list">
                                {items.map((item, index) => (
                                  <li key={`${category}-${index}`} className={getShoppingItemRowClassName(item.name)}>
                                    <label className="shopping-item-label">
                                      <input
                                        type="checkbox"
                                        checked={checkedItems.has(item.name)}
                                        onChange={() => handleToggleCheckedItem(item.name)}
                                        className="shopping-checkbox"
                                      />
                                      <span className="shopping-item-text">{item.name}</span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))
                        ) : (
                          // Fallback: display as flat list if categorization failed or not available
                          <ul>
                            {ingredients.map((ingredient) => (
                              <li key={ingredient} className={getShoppingItemRowClassName(ingredient)}>
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

                    {/* Miscellaneous Items List */}
                    {miscItems.length > 0 && (
                      <div className="misc-items-list">
                        <h4>Miscellaneous Items</h4>
                        <ul>
                          {miscItems.map((item, index) => (
                            <li key={`${item}-${index}`} className={getShoppingItemRowClassName(item)}>
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
  
  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="App">
        <div className="app-loading-screen">
          Loading...
        </div>
      </div>
    );
  }
  
  // Show authentication screen if user is not logged in
  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }
  
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
        
        {/* Display the current date and user info in the banner */}
        <div className="banner-meta">
          <p className="banner-date">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          
          {/* User Dropdown */}
          <div className="user-dropdown-container">
            <button
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="user-dropdown-button"
            >
              <span className="user-dropdown-icon">👤</span>
              <span>
                {userProfile?.username 
                  ? `@${userProfile.username}` 
                  : user?.email 
                    ? user.email.split('@')[0] 
                    : user?.displayName || 'User'}
              </span>
              <span>{isUserDropdownOpen ? '▲' : '▼'}</span>
            </button>
          
          {isUserDropdownOpen && (
            <div className="user-dropdown-menu">
              <div className="user-dropdown-header">
                <div className="user-dropdown-username">
                  {userProfile?.username 
                    ? `@${userProfile.username}` 
                    : user?.email || 'User'}
                </div>
                {userProfile?.firstName && userProfile?.lastName && (
                  <div className="user-dropdown-secondary">
                    {userProfile.firstName} {userProfile.lastName}
                  </div>
                )}
                {!userProfile?.firstName && user?.email && (
                  <div className="user-dropdown-secondary">{user.email}</div>
                )}
              </div>
              <button
                onClick={() => {
                  setIsUserDropdownOpen(false);
                  setIsManageAccountOpen(true);
                }}
                className="user-dropdown-item"
              >
                <span>⚙️</span>
                <span>Manage Account</span>
              </button>
              <button
                onClick={async () => {
                  setIsUserDropdownOpen(false);
                  await handleSignOut();
                }}
                className="user-dropdown-item user-dropdown-item-danger"
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          )}
          </div>
        </div>
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
          <div className="meal-planner-container">
            <div className="calendar-section">
              <Calendar />
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
      
      {/* Chatbot Component */}
      <Chatbot 
        isOpen={isChatbotOpen} 
        onClose={() => setIsChatbotOpen(false)}
        onSaveRecipe={async (recipe) => {
          // Save directly to Firebase
          // Note: saveRecipeToFirestore now returns { id, tags } but chatbot doesn't need the return value
          await saveRecipeToFirestore(recipe);
        }}
        existingRecipes={recipes}
      />
      
      {/* Manage Account Modal */}
      <ManageAccount 
        isOpen={isManageAccountOpen} 
        onClose={() => setIsManageAccountOpen(false)}
        user={user}
      />
      
      <DayMealModal
        isOpen={isDayMealModalOpen}
        date={dayMealTargetDate}
        recipes={recipes}
        weeklyMealPlans={weeklyMealPlans}
        cuisines={CUISINES}
        onAutoSaveMeals={handleDayMealModalAutoSave}
        onClose={handleDayMealModalClose}
      />

      <footer className="app-footer">
        <div className="app-footer-grid">
          <div className="app-footer-column">
            <h4>K&N Meal Planner</h4>
            <p>Plan meals, organize recipes, and build better grocery lists.</p>
          </div>
          <div className="app-footer-column">
            <h5>Plan</h5>
            <span>Meal Planner</span>
            <span>Shopping List</span>
          </div>
          <div className="app-footer-column">
            <h5>Cook</h5>
            <span>Recipe Library</span>
            <span>Shared Recipes</span>
          </div>
          <div className="app-footer-column">
            <h5>Account</h5>
            <span>Manage Account</span>
            <span>Help & Support</span>
          </div>
        </div>
      </footer>
      
    </div>
  );
}

// Export the component so it can be imported and used in other files
// Every React component needs to be exported to be used elsewhere
export default App;
