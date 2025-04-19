# 🍽️ K&N Meal Planner

A personal meal planning application built with React and Firebase to help organize weekly meals, manage recipes, and create shopping lists. This project was created for personal use to streamline meal planning and grocery shopping.

## 🚀 Features

### Meal Planner
- Weekly meal planning with a calendar interface
- Support for multiple recipes per day
- Cuisine-based recipe filtering
- Real-time updates using Firebase

### Recipe Library
- Add and edit recipes with ingredients
- Categorize recipes by cuisine type
- Filter recipes by cuisine
- View recipe details and ingredients

### Shopping List
- Generate shopping lists based on weekly meal plans
- Add miscellaneous items
- Track checked items
- View meal overview for selected week

## 🏗️ Technical Implementation

### Frontend
- React 19 with TypeScript
- Functional components with hooks
- Context API for state management
- Responsive CSS with modern layouts
- Custom scrollbars and animations

### Backend
- Firebase Authentication
- Firebase Firestore for data storage
- Real-time data synchronization
- Offline support

### Data Structure
```typescript
interface Recipe {
  id: string;
  name: string;
  cuisine: string;
  ingredients: string[];
}

interface WeeklyMealPlan {
  [day: string]: string;  // recipe IDs
}

interface ShoppingList {
  ingredients: string[];
  miscItems: string[];
}
```

## 🛠️ Development Setup

1. **Prerequisites**
   ```bash
   node >= 16.0.0
   npm >= 7.0.0
   ```

2. **Installation**
   ```bash
   git clone [repository-url]
   cd meal-planner-app
   npm install
   ```

3. **Environment Setup**
   - Create `.env` file with Firebase configuration
   - Set up Firebase project
   - Configure authentication

4. **Development**
   ```bash
   npm start
   ```

## 📱 UI/UX Features

- Clean, modern interface with a warm color scheme
- Responsive design for all device sizes
- Intuitive navigation with tab-based interface
- Visual feedback for user actions
- Smooth transitions and animations

## 🔒 Security

- Firebase Authentication for user management
- Secure data access rules
- Environment variable protection
- Input validation and sanitization

## 📝 Personal Notes

This application was created to solve personal meal planning challenges:
- Organizing weekly meals
- Managing recipe collections
- Creating efficient shopping lists
- Tracking meal preferences

## 👨‍💻 Author

Kevin Baliat - [GitHub Profile](https://github.com/kevinbaliat)

## 🙏 Acknowledgments

- Firebase Team for the backend services
- React Team for the frontend framework
- Open source community for various libraries
