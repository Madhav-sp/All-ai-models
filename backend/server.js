// server.js

// Import necessary modules
import express from "express"; // Fast, unopinionated, minimalist web framework for Node.js
import cors from "cors"; // Middleware for enabling Cross-Origin Resource Sharing
import dotenv from "dotenv"; // Loads environment variables from a .env file
import helmet from "helmet"; // Helps secure Express apps by setting various HTTP headers
import rateLimit from "express-rate-limit"; // Basic rate-limiting middleware for Express
import OpenAI from "openai"; // OpenAI API client, configured for OpenRouter

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app = express();
// Set the port from environment variables, or default to 5000
const PORT = process.env.PORT || 5000;

// ==========================================
// Middleware for Security and Common Tasks
// ==========================================

// Helmet helps secure your app by setting various HTTP headers.
// It mitigates common web vulnerabilities.
app.use(helmet());

// CORS (Cross-Origin Resource Sharing) configuration
// This middleware allows your frontend application (running on a different origin/port)
// to make requests to this backend server.
app.use(
  cors({
    // `origin` specifies the allowed origins. It's crucial for security.
    // Replace process.env.FRONTEND_URL with your actual frontend URL (e.g., http://localhost:3000 or http://localhost:5173).
    // If not set, requests from other origins will be blocked by the browser's security policy.
    origin: process.env.FRONTEND_URL,
    // `credentials` allows cookies and authorization headers to be sent
    // in cross-origin requests. Set to true if your frontend sends credentials.
    credentials: true,
  })
);

// Rate limiting to protect against brute-force attacks and abuse.
// It limits repeated requests to public APIs or endpoints.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes: Defines the time window for which requests are counted.
  max: 100, // Max 100 requests per IP per windowMs: Limits each IP address to 100 requests.
  message: "Too many requests from this IP, please try again after 15 minutes", // Message returned when limit is exceeded.
});
// Apply the rate limiting middleware to all routes that start with "/api/"
app.use("/api/", limiter);

// Body parser middleware: parses incoming JSON requests and puts the parsed data
// in req.body. Limiting to 10mb to prevent very large payloads.
app.use(express.json({ limit: "10mb" }));

// ==========================================
// OpenRouter API Configuration
// ==========================================

// Initialize the OpenAI client, pointing its baseURL to OpenRouter.
// The API key is fetched from environment variables for security.
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1", // OpenRouter API base URL
  apiKey: process.env.OPENROUTER_API_KEY, // Your OpenRouter API Key from .env
  // Optional: Headers for tracking and ranking on openrouter.ai
  defaultHeaders: {
    "HTTP-Referer": process.env.YOUR_SITE_URL, // e.g., 'https://yoursite.com'
    "X-Title": process.env.YOUR_SITE_NAME, // e.g., 'Your App Name'
  },
});

// ==========================================
// API ROUTES
// ==========================================

/**
 * POST /api/chat/completion
 * Handles chat completion requests by forwarding them to the OpenRouter API.
 */
app.post("/api/chat/completion", async (req, res) => {
  try {
    // Destructure messages and model from the request body
    // Default model to 'openai/gpt-4o' if not provided
    const { messages, model = "openai/gpt-4o" } = req.body;

    // Input validation: Ensure messages array is present and not empty
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages array is required and cannot be empty",
      });
    }

    // Validate message format: Check if each message has a role and content
    // and if the role is one of the allowed types.
    const isValidMessages = messages.every(
      (msg) =>
        msg.role &&
        msg.content &&
        ["user", "assistant", "system"].includes(msg.role)
    );

    if (!isValidMessages) {
      return res.status(400).json({
        error:
          "Invalid message format. Each message must have 'role' (user, assistant, system) and 'content'.",
      });
    }

    // Call the OpenRouter chat completions API using the configured OpenAI client
    const completion = await openai.chat.completions.create({
      model, // The AI model to use (e.g., 'openai/gpt-4o')
      messages, // The conversation messages history
      max_tokens: 1000, // Max tokens for the AI's response (adjust as needed)
      temperature: 0.7, // Creativity of the response (0.0 - 2.0)
    });

    // Send back a successful response with the AI's message and usage info
    res.json({
      success: true,
      data: {
        message: completion.choices[0].message, // The actual AI message
        usage: completion.usage, // API token usage details
      },
    });
  } catch (error) {
    // Log the full error for debugging purposes in the backend console
    console.error("OpenRouter API Error in /api/chat/completion:", error);

    // Handle specific API error statuses and return appropriate responses
    if (error.status === 401) {
      return res
        .status(401)
        .json({ error: "Invalid API key provided to OpenRouter." });
    }

    if (error.status === 429) {
      return res
        .status(429)
        .json({ error: "Rate limit exceeded for OpenRouter API." });
    }

    // Generic internal server error for other cases
    res.status(500).json({
      error: "Internal server error.",
      // Include the actual error message only in development mode for security
      message:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * GET /api/models
 * Fetches the list of available models from the OpenRouter API.
 */
app.get("/api/models", async (req, res) => {
  try {
    // Directly fetch models from OpenRouter's API
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, // Authenticate with your API key
      },
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || "Failed to fetch models from OpenRouter."
      );
    }

    const data = await response.json();
    // OpenRouter's models endpoint returns an object with a 'data' array
    res.json({ success: true, data: data.data });
  } catch (error) {
    // Log the error and send a 500 response
    console.error("Error fetching models from OpenRouter API:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch models from external API." });
  }
});

/**
 * GET /api/health
 * Simple health check endpoint to verify the server is running.
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ==========================================
// Server Start
// ==========================================

// Start the Express server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend URL expected at: ${process.env.FRONTEND_URL}`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn(
      "WARNING: OPENROUTER_API_KEY is not set in .env! API calls may fail."
    );
  }
});
