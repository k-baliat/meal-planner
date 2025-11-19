// Import React hooks for managing component state and side effects
// useState allows us to store and update data that changes over time
// useRef allows us to reference DOM elements directly
// useEffect allows us to perform side effects (like scrolling) when data changes
import React, { useState, useRef, useEffect } from 'react';

// Import the Google Generative AI library for Gemini API
import { GoogleGenerativeAI } from '@google/generative-ai';

// Import prompt configurations
import promptsConfig from './prompts.json';
import recipeFormatConfig from './recipe-format.json';

// Import CSS for styling
import './App.css';

/**
 * Message Interface
 * 
 * This interface defines the structure of a chat message.
 * Each message has a role (either 'user' or 'assistant') and content (the message text).
 */
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Recipe Interface
 * 
 * This matches the Recipe interface from App.tsx
 */
interface Recipe {
  id?: string;
  name: string;
  cuisine: string;
  ingredients: string[];
}

/**
 * Chatbot Component Props
 * 
 * This interface defines the props that the Chatbot component accepts.
 * - isOpen: Whether the chatbot panel is currently visible
 * - onClose: Function to call when the user wants to close the chatbot
 * - onSaveRecipe: Optional callback function to save recipe directly to Firebase
 * - existingRecipes: Optional array of existing recipes to check for duplicates
 */
interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRecipe?: (recipe: Omit<Recipe, 'id'>) => Promise<void>;
  existingRecipes?: Recipe[];
}

/**
 * Chatbot Component
 * 
 * This component creates an AI-powered chatbot interface using Google's Gemini API.
 * It provides a chat interface where users can ask questions about recipes and cooking.
 * 
 * Key Features:
 * - Chat history with user and assistant messages
 * - Auto-scrolling to latest message
 * - Loading states during API calls
 * - Error handling
 * - Clean, user-friendly UI
 */
const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose, onSaveRecipe, existingRecipes = [] }) => {
  // State to store all chat messages
  // Messages are stored as an array of Message objects
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: promptsConfig.welcomeMessage
    }
  ]);

  // State to track if we're currently formatting a recipe for saving
  const [isFormattingRecipe, setIsFormattingRecipe] = useState(false);
  
  // State to store the last recipe response that can be saved
  const [lastRecipeResponse, setLastRecipeResponse] = useState<string | null>(null);

  // State to store the current input text
  // This is what the user types in the input field
  const [input, setInput] = useState('');

  // State to track if we're currently waiting for an API response
  // This helps us show a loading indicator
  const [isLoading, setIsLoading] = useState(false);

  // Reference to the messages container div
  // We use this to automatically scroll to the bottom when new messages arrive
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Auto-scroll to Bottom
   * 
   * This effect runs whenever messages change.
   * It automatically scrolls the chat window to show the latest message.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Send Message Function
   * 
   * This function handles sending a message to the Gemini API and receiving a response.
   * 
   * Steps:
   * 1. Validate that the user has typed something
   * 2. Add the user's message to the chat
   * 3. Clear the input field
   * 4. Call the Gemini API
   * 5. Add the assistant's response to the chat
   * 6. Handle any errors that occur
   */
  const sendMessage = async () => {
    // Don't send empty messages or if already loading
    if (!input.trim() || isLoading) return;

    // Get the API key from environment variables
    // REACT_APP_ prefix is required for Create React App to expose env variables
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    
    if (!apiKey) {
      // If no API key is found, show an error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Error: Gemini API key not found. Please add REACT_APP_GEMINI_API_KEY to your .env file.'
      }]);
      return;
    }

    // Store the user's message
    const userMessage = input.trim();
    
    // Clear the input field first
    setInput('');
    
    // Add user message to chat immediately for responsive UI
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Set loading state to true
    setIsLoading(true);

    try {
      // Debug: Log API key status (don't log the actual key for security)
      console.log('API Key present:', !!apiKey);
      console.log('Sending message:', userMessage);
      
      // Initialize the Gemini API client
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Get the Gemini model
      // Using 'models/gemini-2.5-flash' which is fast and widely available
      // Alternative models: 'models/gemini-2.5-pro' (more capable but slower)
      const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });

      // Create a conversation history for context (excluding the welcome message and the current user message)
      // This helps the AI understand the conversation flow
      // We need to convert our messages to Gemini's format: { role: 'user' | 'model', parts: [{ text: string }] }
      // Note: We use messages state BEFORE adding the current user message, so we need to get the previous messages
      const previousMessages = messages.slice(1); // Skip the welcome message
      const conversationHistory = previousMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      console.log('Conversation history length:', conversationHistory.length);

      // Start a chat session with the conversation history
      // Include the system prompt in the first message if this is a new conversation
      const systemPrompt = promptsConfig.systemPrompt;
      let enhancedUserMessage = userMessage;
      
      // If this is the first message, prepend the system prompt
      if (conversationHistory.length === 0) {
        enhancedUserMessage = `${systemPrompt}\n\nUser question: ${userMessage}`;
      }

      const chat = model.startChat({
        history: conversationHistory.length > 0 ? conversationHistory : undefined,
      });

      // Send the current message and get the response
      console.log('Sending to Gemini API...');
      const result = await chat.sendMessage(enhancedUserMessage);
      const response = await result.response;
      const text = response.text();
      
      console.log('Received response from Gemini API');

      // Check if the response contains a recipe (look for common recipe indicators)
      // A recipe typically has both ingredients and instructions/steps
      const hasIngredients = /ingredients?/i.test(text);
      const hasInstructions = /(instructions?|steps?|directions?|method|how to cook|how to make)/i.test(text);
      const hasRecipeName = /^(#+\s*)?[A-Z][a-z]+.*(recipe|dish|meal)/mi.test(text) || 
                           /recipe:?\s*[A-Z][a-z]+/i.test(text);
      
      // Consider it a recipe if it has ingredients AND (instructions OR a clear recipe name)
      const containsRecipe = hasIngredients && (hasInstructions || hasRecipeName);

      // Add the assistant's response to the chat
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
      
      // If the response contains a recipe and we have a callback function, store it for potential saving
      if (containsRecipe && onSaveRecipe) {
        setLastRecipeResponse(text);
      } else {
        setLastRecipeResponse(null);
      }
    } catch (error: any) {
      // Handle any errors that occur during the API call
      console.error('Error calling Gemini API:', error);
      
      // Extract more detailed error information
      let errorMessage = '❌ Sorry, I encountered an error.';
      
      if (error?.message) {
        // If we have a specific error message, include it
        errorMessage += ` ${error.message}`;
      } else if (error?.error?.message) {
        // Some errors are nested in an error object
        errorMessage += ` ${error.error.message}`;
      } else if (typeof error === 'string') {
        errorMessage += ` ${error}`;
      }
      
      // Add troubleshooting tips
      errorMessage += '\n\n💡 Troubleshooting tips:\n';
      errorMessage += '• Make sure your API key is correct\n';
      errorMessage += '• Restart your dev server after adding the API key\n';
      errorMessage += '• Check the browser console for more details';
      
      // Show a user-friendly error message with details
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage
      }]);
    } finally {
      // Always set loading to false when done (whether success or error)
      setIsLoading(false);
    }
  };

  /**
   * Handle Save Recipe
   * 
   * This function formats the recipe response and passes it to the recipe form.
   * It uses the recipe format prompt to extract structured data from the AI response.
   */
  const handleSaveRecipe = async () => {
    if (!lastRecipeResponse || !onSaveRecipe || isFormattingRecipe) return;

    setIsFormattingRecipe(true);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '🔄 Formatting recipe...'
    }]);

    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('API key not found');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });

      // Create a prompt that includes the format instructions and the recipe text
      const formatPrompt = `${recipeFormatConfig.formatPrompt}\n\n${recipeFormatConfig.extractionPrompt}\n\nRecipe text to format:\n\n${lastRecipeResponse}`;

      // Get formatted recipe from AI
      const result = await model.generateContent(formatPrompt);
      const response = await result.response;
      const formattedText = response.text();

      // Extract JSON from the response (it might have markdown code blocks)
      let jsonText = formattedText.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      // Parse the JSON
      const recipeData: Recipe = JSON.parse(jsonText);

      // Validate the recipe data
      if (!recipeData.name || !recipeData.cuisine || !recipeData.ingredients || !Array.isArray(recipeData.ingredients)) {
        throw new Error('Invalid recipe format received from AI');
      }

      // Validate cuisine - must be one of the allowed values
      const validCuisines = ['American', 'Asian', 'Colombian', 'Hawaiian', 'Italian', 'Kenyan', 'Mexican', 'Misc'];
      if (!validCuisines.includes(recipeData.cuisine)) {
        // If cuisine is not valid, default to 'Misc'
        recipeData.cuisine = 'Misc';
      }

      // Check if recipe already exists
      const recipeExists = existingRecipes.some(
        r => r.name.toLowerCase() === recipeData.name.toLowerCase()
      );

      if (recipeExists) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ A recipe named "${recipeData.name}" already exists in your library.`
        }]);
        setIsFormattingRecipe(false);
        return;
      }

      // Save directly to Firebase
      await onSaveRecipe({
        name: recipeData.name,
        cuisine: recipeData.cuisine,
        ingredients: recipeData.ingredients
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Recipe "${recipeData.name}" has been saved to your recipe library!`
      }]);

      // Clear the last recipe response
      setLastRecipeResponse(null);
    } catch (error: any) {
      console.error('Error formatting/saving recipe:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Sorry, I couldn't save the recipe. ${error.message || 'Please try again.'}`
      }]);
    } finally {
      setIsFormattingRecipe(false);
    }
  };

  /**
   * Handle Enter Key Press
   * 
   * This function allows users to submit messages by pressing Enter.
   * It prevents the default form submission behavior.
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Don't render anything if the chatbot is closed
  if (!isOpen) return null;

  // Render the chatbot panel
  return (
    <div className="chatbot-overlay" onClick={onClose}>
      <div className="chatbot-panel" onClick={(e) => e.stopPropagation()}>
        {/* Chatbot Header */}
        <div className="chatbot-header">
          <div className="chatbot-header-content">
            <h2 className="chatbot-title">
              👨‍🍳 Chat with Chef Coco
            </h2>
            <button 
              className="chatbot-close-button"
              onClick={onClose}
              aria-label="Close chatbot"
            >
              ×
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div className="chatbot-messages">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1;
            const showSaveButton = isLastMessage && 
                                   message.role === 'assistant' && 
                                   lastRecipeResponse && 
                                   onSaveRecipe &&
                                   !isFormattingRecipe;
            
            return (
              <div 
                key={index} 
                className={`chatbot-message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
              >
                <div className="message-content">
                  {message.content}
                  {showSaveButton && (
                    <div className="save-recipe-prompt">
                      <button
                        className="save-recipe-button"
                        onClick={handleSaveRecipe}
                        disabled={isFormattingRecipe}
                      >
                        💾 Save Recipe to Library
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="chatbot-message assistant-message">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Container */}
        <div className="chatbot-input-container">
          <input
            type="text"
            className="chatbot-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about cooking, recipes, or meal planning..."
            disabled={isLoading}
          />
          <button
            className="chatbot-send-button"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <span className="send-icon">➤</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Export the component so it can be used in other files
export default Chatbot;

