import React, { useEffect, useMemo, useState } from 'react';
import './MealRecommendationModal.css';
import SearchableDropdown, { SearchableOption } from './SearchableDropdown';

interface DayMealRecipe {
  id?: string;
  name: string;
  cuisine: string;
  tags?: string[];
}

interface WeeklyMealPlan {
  [key: string]: string;
}

interface WeeklyMealPlans {
  [key: string]: WeeklyMealPlan;
}

interface DayMealModalProps {
  isOpen: boolean;
  date: Date | null;
  recipes: DayMealRecipe[];
  weeklyMealPlans: WeeklyMealPlans;
  cuisines: readonly string[];
  onAutoSaveMeals: (targetDate: Date, mealIds: string[]) => Promise<void> | void;
  onClose: (targetDate: Date) => void;
}

const getWeekRange = (date: Date): string => {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - (date.getDay() || 7) + 1);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;
};

const shuffleWithFisherYates = <T,>(items: T[]): T[] => {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
};

const sampleRecipes = (
  source: DayMealRecipe[],
  count: number,
  excludedIds: Set<string> = new Set()
): DayMealRecipe[] => {
  const selectable = source.filter((recipe) => recipe.id && !excludedIds.has(recipe.id));
  const shuffled = shuffleWithFisherYates(selectable);
  return shuffled.slice(0, count);
};

const getRecipeImage = (recipe: DayMealRecipe): string | null => {
  const recipeData = recipe as unknown as Record<string, unknown>;
  const imageCandidate =
    recipeData.imageThumbnail ||
    recipeData.imageUrl ||
    recipeData.thumbnailUrl ||
    recipeData.image;

  return typeof imageCandidate === 'string' && imageCandidate.trim()
    ? imageCandidate
    : null;
};

const getPrepTimeLabel = (recipe: DayMealRecipe): string | null => {
  const recipeData = recipe as unknown as Record<string, unknown>;
  const numericPrep =
    recipeData.prepTimeMinutes ||
    recipeData.prepMinutes ||
    recipeData.prep_time_minutes;

  if (typeof numericPrep === 'number' && Number.isFinite(numericPrep) && numericPrep > 0) {
    return `${numericPrep} min`;
  }

  const textPrep = recipeData.prepTime || recipeData.prep_time;
  if (typeof textPrep === 'string' && textPrep.trim()) {
    return textPrep.trim();
  }

  return null;
};

const DayMealModal: React.FC<DayMealModalProps> = ({
  isOpen,
  date,
  recipes,
  weeklyMealPlans,
  cuisines,
  onAutoSaveMeals,
  onClose
}) => {
  const [displayedRecipes, setDisplayedRecipes] = useState<DayMealRecipe[]>([]);
  const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
  const [selectedCuisine, setSelectedCuisine] = useState<string>('');
  const [manualRecipeSelection, setManualRecipeSelection] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !date) {
      setDisplayedRecipes([]);
      setSelectedMeals([]);
      setSelectedCuisine('');
      setManualRecipeSelection('');
      return;
    }

    const weekRange = getWeekRange(date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const existingValue = weeklyMealPlans[weekRange]?.[dayName] || '';
    const initialSelectedMeals = existingValue
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const initialRecommendations = sampleRecipes(recipes, 3);
    setDisplayedRecipes(initialRecommendations);
    setSelectedMeals(initialSelectedMeals);
    setSelectedCuisine('');
    setManualRecipeSelection('');
  }, [isOpen, date, recipes, weeklyMealPlans]);

  const dayName = useMemo(() => {
    if (!date) return 'Day';
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }, [date]);

  const dateLabel = useMemo(() => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }, [date]);

  const handleRefresh = () => {
    const currentIds = new Set(displayedRecipes.map((recipe) => recipe.id).filter(Boolean) as string[]);
    const freshSample = sampleRecipes(recipes, 3, currentIds);

    if (freshSample.length === 3 || recipes.length <= 3) {
      setDisplayedRecipes(freshSample.length > 0 ? freshSample : sampleRecipes(recipes, 3));
      return;
    }

    // If excluding currently displayed recipes leaves too few options,
    // fill from full set to keep up to 3 cards.
    const fallbackPool = sampleRecipes(recipes, 3);
    const merged = [...freshSample];
    fallbackPool.forEach((recipe) => {
      if (merged.length < 3 && recipe.id && !merged.some((item) => item.id === recipe.id)) {
        merged.push(recipe);
      }
    });

    setDisplayedRecipes(merged);
  };

  const filteredRecipes = useMemo(() => {
    if (!selectedCuisine) return recipes;
    return recipes.filter((recipe) => recipe.cuisine === selectedCuisine);
  }, [recipes, selectedCuisine]);

  const sortedManualRecipes = useMemo(() => {
    return filteredRecipes
      .filter((recipe) => recipe.id && !selectedMeals.includes(recipe.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredRecipes, selectedMeals]);

  const cuisineOptions = useMemo<SearchableOption[]>(
    () => cuisines.map((cuisine) => ({ value: cuisine, label: cuisine })),
    [cuisines]
  );

  const manualRecipeOptions = useMemo<SearchableOption[]>(
    () =>
      sortedManualRecipes.map((recipe) => ({
        value: recipe.id || '',
        label: recipe.name
      })),
    [sortedManualRecipes]
  );

  const persistMeals = async (nextMeals: string[]) => {
    if (!date) return;
    setSelectedMeals(nextMeals);
    setIsSaving(true);
    try {
      await onAutoSaveMeals(date, nextMeals);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMeal = async (mealId: string) => {
    const nextMeals = selectedMeals.filter((id) => id !== mealId);
    await persistMeals(nextMeals);
  };

  const handleAddMeal = async (recipeId: string) => {
    if (!recipeId || selectedMeals.includes(recipeId)) return;
    const nextMeals = [...selectedMeals, recipeId];
    await persistMeals(nextMeals);
  };

  const handleManualAdd = async (recipeId: string) => {
    if (!recipeId) return;
    await handleAddMeal(recipeId);
    setManualRecipeSelection('');
  };

  const handleClose = () => {
    if (!date) {
      return;
    }
    onClose(date);
  };

  if (!isOpen || !date) return null;

  return (
    <div className="meal-recommendation-overlay" onClick={handleClose}>
      <div className="meal-recommendation-modal" onClick={(event) => event.stopPropagation()}>
        <div className="meal-recommendation-header">
          <div>
            <h2>{dateLabel}</h2>
            <p className="meal-recommendation-subtitle">Plan meals for this day</p>
          </div>
          <button
            type="button"
            className="meal-recommendation-close"
            aria-label="Close day meal modal"
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        <div className="meal-recommendation-content">
          <div className="selected-meals-section">
            <div className="selected-meals-header">
              <h3>Selected Meals</h3>
            </div>
            <div className="selected-meals-content expanded">
              {selectedMeals.length > 0 ? (
                selectedMeals.map((mealId) => {
                  const recipe = recipes.find((item) => item.id === mealId);
                  return (
                    <div key={mealId} className="selected-meal">
                      <span>{recipe?.name || 'Unknown recipe'}</span>
                      <button
                        type="button"
                        className="remove-meal-button"
                        onClick={() => { void handleRemoveMeal(mealId); }}
                        disabled={isSaving}
                        aria-label={`Remove ${recipe?.name || 'meal'}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="meal-recommendation-empty-text">No meals selected</p>
              )}
            </div>
          </div>

          <div className="meal-recommendation-grid-header">
            <h3>Recommendations</h3>
            <button
              type="button"
              className="meal-recommendation-refresh"
              onClick={handleRefresh}
              disabled={recipes.length <= 1}
            >
              Refresh
            </button>
          </div>

          {displayedRecipes.length > 0 ? (
            <div className="meal-recommendation-grid">
              {displayedRecipes.map((recipe) => {
                const recipeId = recipe.id || '';
                const image = getRecipeImage(recipe);
                const prepTime = getPrepTimeLabel(recipe);

                return (
                  <button
                    type="button"
                    key={recipeId || recipe.name}
                    className="meal-recommendation-card"
                    onClick={() => { if (recipeId) { void handleAddMeal(recipeId); } }}
                    disabled={!recipeId || !recipe.id || selectedMeals.includes(recipeId) || isSaving}
                  >
                    {image && (
                      <div className="meal-recommendation-image-wrap">
                        <img src={image} alt={recipe.name} className="meal-recommendation-image" />
                      </div>
                    )}
                    <div className="meal-recommendation-body">
                      <h3>{recipe.name}</h3>
                      <span className="meal-recommendation-cuisine">{recipe.cuisine}</span>
                      {recipe.tags && recipe.tags.length > 0 && (
                        <p className="meal-recommendation-tags">{recipe.tags.slice(0, 2).join(', ')}</p>
                      )}
                      {prepTime && (
                        <p className="meal-recommendation-meta">Prep: {prepTime}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="meal-recommendation-empty">
              No recipes available yet. Add recipes in Recipe Library to get recommendations.
            </div>
          )}

          <div className="meal-selector">
            <div className="meal-selector-controls">
              <div className="cuisine-filter">
                <label htmlFor="day-modal-cuisine-filter">Filter by Cuisine:</label>
                <SearchableDropdown
                  id="day-modal-cuisine-filter"
                  value={selectedCuisine}
                  options={cuisineOptions}
                  onChange={setSelectedCuisine}
                  emptyOptionLabel="All Cuisines"
                  placeholder="Type cuisine or choose from list..."
                  className="cuisine-dropdown searchable-dropdown-input"
                  disabled={isSaving}
                />
              </div>

              <div className="recipe-selector">
                <label htmlFor="day-modal-meal-dropdown">Add Recipe:</label>
                <SearchableDropdown
                  id="day-modal-meal-dropdown"
                  value={manualRecipeSelection}
                  options={manualRecipeOptions}
                  onChange={(recipeId) => {
                    setManualRecipeSelection(recipeId);
                    if (recipeId) {
                      void handleManualAdd(recipeId);
                    }
                  }}
                  placeholder="Type recipe name or choose from list..."
                  emptyOptionLabel="Choose a recipe..."
                  className="meal-dropdown searchable-dropdown-input"
                  disabled={isSaving}
                />
                {sortedManualRecipes.length === 0 && (
                  <small className="meal-selector-empty-text">
                    {selectedCuisine ? `No ${selectedCuisine} recipes available` : 'No recipes available'}
                  </small>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="meal-recommendation-actions">
          <button
            type="button"
            className="save-button"
            onClick={handleClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default DayMealModal;
