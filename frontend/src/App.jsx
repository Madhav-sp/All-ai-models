import React, { useState, useEffect, useRef } from "react";

// Main App component which will render the ChatComponent
export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("openai/gpt-4o");
  // New state for Gemini-powered features
  const [geminiLoading, setGeminiLoading] = useState(false);

  // Ref for auto-scrolling to the latest message
  const messagesEndRef = useRef(null);

  // Define API_BASE_URL here. This should match your backend server's address.
  // In a real Vite app, this would come from import.meta.env.VITE_API_URL
  // or process.env.REACT_APP_API_URL for Create React App (CRA).
  const API_BASE_URL = "http://localhost:5000/api"; // Your backend API base URL

  /**
   * Represents a simplified API service for chat and model interaction.
   * This is embedded directly in App.jsx for self-containment as requested,
   * but in a larger project, it would typically be in a separate file (e.g., apiService.js).
   */
  const ApiService = {
    /**
     * Sends messages to the chat completion endpoint on your backend.
     * @param {Array<Object>} messages - Array of message objects ({ role: string, content: string }).
     * @param {string} model - The model ID to use for the completion.
     * @returns {Promise<Object>} The API response data.
     */
    chatCompletion: async (messages, model = "openai/gpt-4o") => {
      try {
        const response = await fetch(`${API_BASE_URL}/chat/completion`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages, model }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          // Throw an error with the backend message if available
          throw new Error(errorData.error || "API request failed");
        }

        return await response.json();
      } catch (error) {
        console.error("API Error (chatCompletion):", error);
        throw error; // Re-throw to be caught by the calling component
      }
    },

    /**
     * Fetches the list of available models from your backend.
     * @returns {Promise<Object>} The API response data containing models.
     */
    getModels: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/models`);
        if (!response.ok) {
          // If the response is not OK, throw an error
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch models");
        }
        return await response.json();
      } catch (error) {
        console.error("API Error (getModels):", error);
        throw error; // Re-throw to be caught by the calling component
      }
    },

    /**
     * Calls the Gemini API directly from the frontend to summarize provided text.
     * Uses gemini-2.0-flash model for text generation.
     * @param {string} textToSummarize - The text content to be summarized.
     * @returns {Promise<string>} The summarized text.
     */
    summarizeText: async (textToSummarize) => {
      try {
        let chatHistory = [];
        chatHistory.push({
          role: "user",
          parts: [
            {
              text: `Summarize the following conversation:\n\n${textToSummarize}`,
            },
          ],
        });
        const payload = { contents: chatHistory };
        // The API key is automatically provided by the Canvas runtime when left empty.
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (
          result.candidates &&
          result.candidates.length > 0 &&
          result.candidates[0].content &&
          result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0
        ) {
          return result.candidates[0].content.parts[0].text;
        } else {
          throw new Error(
            "No summary generated or unexpected API response structure."
          );
        }
      } catch (error) {
        console.error("Gemini API Error (summarizeText):", error);
        throw new Error(`Failed to summarize: ${error.message || error}`);
      }
    },

    /**
     * Calls the Gemini API directly from the frontend to suggest follow-up questions based on provided text.
     * Uses gemini-2.0-flash model for text generation.
     * @param {string} textForQuestions - The text content to base questions on.
     * @returns {Promise<string>} A string containing suggested questions.
     */
    generateFollowUpQuestions: async (textForQuestions) => {
      try {
        let chatHistory = [];
        chatHistory.push({
          role: "user",
          parts: [
            {
              text: `Based on the following conversation, suggest 3-5 concise follow-up questions:\n\n${textForQuestions}`,
            },
          ],
        });
        const payload = { contents: chatHistory };
        // The API key is automatically provided by the Canvas runtime when left empty.
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (
          result.candidates &&
          result.candidates.length > 0 &&
          result.candidates[0].content &&
          result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0
        ) {
          return result.candidates[0].content.parts[0].text;
        } else {
          throw new Error(
            "No questions generated or unexpected API response structure."
          );
        }
      } catch (error) {
        console.error("Gemini API Error (generateFollowUpQuestions):", error);
        throw new Error(
          `Failed to suggest questions: ${error.message || error}`
        );
      }
    },
  };

  /**
   * Scrolls the messages container to the bottom smoothly.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Effect to load models when the component mounts
  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await ApiService.getModels();
        // Assuming response.data contains the array of models
        setModels(response.data || []);
        if (response.data && response.data.length > 0) {
          setSelectedModel(response.data[0].id); // Select the first model by default
        }
      } catch (err) {
        console.error("Failed to load models:", err);
        setError(
          "Failed to load AI models. Please check your backend. The API might be down or unreachable."
        );
      }
    };
    loadModels();
  }, []); // Empty dependency array ensures this runs once on mount

  // Effect to scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Handles sending a message to the AI.
   * @param {Event} e - The form submission event.
   */
  const sendMessage = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior (page reload)

    // Ensure input is not empty and no other operation is in progress
    if (!input.trim() || loading || geminiLoading) {
      return;
    }

    // Create a unique ID for the user message
    const userMessage = { id: Date.now(), role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];

    // Optimistically update the UI with the user's message
    setMessages(newMessages);
    setInput(""); // Clear the input field
    setLoading(true); // Set loading state for main chat
    setError(null); // Clear any previous errors

    try {
      const response = await ApiService.chatCompletion(
        newMessages,
        selectedModel
      );
      // CORRECTED LINE: Access the 'content' property from the message object
      const aiMessage = {
        id: Date.now() + 1,
        role: response.data.message.role || "assistant", // Use actual role if available
        content: response.data.message.content || "", // Ensure content is a string
      };
      setMessages([...newMessages, aiMessage]); // Add AI's response to messages
    } catch (err) {
      setError(err.message); // Set error message
      console.error("Chat error:", err);
    } finally {
      setLoading(false); // Always set loading to false
    }
  };

  /**
   * Clears all messages from the chat.
   */
  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  /**
   * Summarizes the current chat conversation using Gemini API.
   */
  const summarizeChat = async () => {
    if (messages.length === 0 || geminiLoading || loading) {
      setError(
        "No conversation to summarize or another AI operation is in progress."
      );
      return;
    }

    setGeminiLoading(true);
    setError(null);

    // Format the conversation for the LLM
    const fullConversation = messages
      .map((msg) => `${msg.role === "user" ? "You" : "AI"}: ${msg.content}`)
      .join("\n");
    const tempMessageId = Date.now(); // Temporary ID for the "Summarizing..." message
    const summarizingMessage = {
      id: tempMessageId,
      role: "assistant",
      content: "AI: ✨ Summarizing conversation...",
    };
    setMessages((prev) => [...prev, summarizingMessage]); // Add temporary loading message

    try {
      const summary = await ApiService.summarizeText(fullConversation);
      // Remove temporary message and add the summary
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: "assistant",
          content: `AI: ✨ Summary:\n${summary}`,
        },
      ]);
    } catch (err) {
      // Remove temporary message and show error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      setError(`Failed to summarize: ${err.message}`);
      console.error("Summarization error:", err);
    } finally {
      setGeminiLoading(false);
    }
  };

  /**
   * Generates follow-up questions based on the current chat conversation using Gemini API.
   */
  const suggestFollowUpQuestions = async () => {
    if (messages.length === 0 || geminiLoading || loading) {
      setError(
        "No conversation to suggest questions for or another AI operation is in progress."
      );
      return;
    }

    setGeminiLoading(true);
    setError(null);

    // Format the conversation for the LLM
    const fullConversation = messages
      .map((msg) => `${msg.role === "user" ? "You" : "AI"}: ${msg.content}`)
      .join("\n");
    const tempMessageId = Date.now(); // Temporary ID for the "Suggesting..." message
    const suggestingMessage = {
      id: tempMessageId,
      role: "assistant",
      content: "AI: ✨ Suggesting follow-up questions...",
    };
    setMessages((prev) => [...prev, suggestingMessage]); // Add temporary loading message

    try {
      const questions = await ApiService.generateFollowUpQuestions(
        fullConversation
      );
      // Remove temporary message and add the questions
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 3,
          role: "assistant",
          content: `AI: ✨ Suggested Questions:\n${questions}`,
        },
      ]);
    } catch (err) {
      // Remove temporary message and show error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      setError(`Failed to suggest questions: ${err.message}`);
      console.error("Question suggestion error:", err);
    } finally {
      setGeminiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-inter antialiased">
      {/* Tailwind CSS CDN for styling */}
      <script src="https://cdn.tailwindcss.com"></script>

      {/* Chat Container */}
      <div className="flex flex-col flex-grow w-full max-w-2xl mx-auto my-4 bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Chat Header */}
        <div className="flex justify-between items-center p-4 bg-blue-600 text-white rounded-t-lg shadow-md">
          <h2 className="text-2xl font-bold">AI Chat</h2>
          <div className="flex space-x-3 items-center">
            {models.length > 0 ? (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={loading || geminiLoading}
                className="p-2 rounded-md bg-blue-700 text-white border border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name || model.id}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm">Loading models...</span>
            )}
            <button
              onClick={clearChat}
              disabled={loading || geminiLoading}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition duration-200 ease-in-out shadow-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* Error Message Display */}
        {error && (
          <div className="p-3 bg-red-100 text-red-700 border-l-4 border-red-500 rounded-b-md text-sm">
            Error: {error}
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-grow p-4 overflow-y-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id} // Using unique ID for key for React reconciliation
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-xl shadow-sm text-sm ${
                  message.role === "user"
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-gray-200 text-gray-800 rounded-bl-none"
                }`}
              >
                <strong>{message.role === "user" ? "You" : "AI"}:</strong>
                {/* Ensure message.content is a string before rendering */}
                <p className="whitespace-pre-wrap">
                  {typeof message.content === "string"
                    ? message.content
                    : JSON.stringify(message.content)}
                </p>
              </div>
            </div>
          ))}
          {(loading || geminiLoading) && ( // Show a specific loading message for AI operations
            <div className="flex justify-start">
              <div className="max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-xl shadow-sm bg-gray-200 text-gray-800 rounded-bl-none text-sm">
                <strong>AI:</strong>
                <p>✨ Thinking...</p>
              </div>
            </div>
          )}
          {/* Empty div to ensure auto-scroll works */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form and Gemini Features Buttons */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col space-y-3">
          <div className="flex justify-end space-x-3">
            <button
              onClick={summarizeChat}
              disabled={geminiLoading || loading || messages.length === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition duration-200 ease-in-out shadow-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              ✨ Summarize Chat
            </button>
            <button
              onClick={suggestFollowUpQuestions}
              disabled={geminiLoading || loading || messages.length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition duration-200 ease-in-out shadow-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              ✨ Suggest Questions
            </button>
          </div>
          <form onSubmit={sendMessage} className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading || geminiLoading}
              className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={loading || geminiLoading || !input.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition duration-200 ease-in-out shadow-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
