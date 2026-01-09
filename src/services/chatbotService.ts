/**
 * AI Chatbot Service
 * 
 * Supports multiple AI providers:
 * 1. Google Gemini (Recommended - Best free tier)
 * 2. Hugging Face Inference API
 * 3. OpenAI GPT-3.5-turbo (with free tier)
 * 
 * Usage:
 * import { chatbotService } from '../services/chatbotService';
 * 
 * const response = await chatbotService.sendMessage("What services do you offer?");
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatbotConfig {
  provider: 'gemini' | 'huggingface' | 'openai' | 'groq';
  apiKey: string;
  model?: string;
}

class ChatbotService {
  private static instance: ChatbotService;
  private conversationHistory: ChatMessage[] = [];
  private config: ChatbotConfig | null = null;
  private readonly MAX_HISTORY = 10; // Keep last 10 messages for context

  private constructor() {
    this.initializeSystemPrompt();
    // Initialize config synchronously, then fix if needed
    this.loadConfig().then(() => {
      this.autoConfigure(); // This will fix the config if needed
    });
  }

  /**
   * Auto-configure chatbot with Groq API key (no billing required)
   */
  private async autoConfigure(): Promise<void> {
    try {
      // Always use Groq - replace any existing Gemini configs
      if (this.config) {
        // If using Gemini (which has quota issues), switch to Groq
        if (this.config.provider === 'gemini') {
          console.log('🔄 Switching from Gemini to Groq (no billing required)...');
          const groqConfig: ChatbotConfig = {
            provider: 'groq',
            apiKey: '', // User must configure API key in app settings
            model: 'llama-3.1-8b-instant',
          };
          await this.setConfig(groqConfig);
          this.config = groqConfig;
          console.log('✅ Chatbot switched to Groq');
        } else if (this.config.provider === 'groq' && !this.config.apiKey) {
          // Groq provider but no API key - user needs to configure it
          // API key should be set through the config screen
          this.config.model = this.config.model || 'llama-3.1-8b-instant';
          await this.setConfig(this.config);
          console.log('✅ Groq API key added');
        }
      } else {
        // No config exists, create default with Groq (no billing required)
        // Note: User needs to configure API key in the app settings
        const defaultConfig: ChatbotConfig = {
          provider: 'groq',
          apiKey: '', // User must configure their API key in the app
          model: 'llama-3.1-8b-instant', // Fast and free
        };
        await this.setConfig(defaultConfig);
        this.config = defaultConfig;
        console.log('✅ Chatbot auto-configured with Groq');
      }
    } catch (error) {
      console.error('Failed to auto-configure chatbot:', error);
    }
  }

  public static getInstance(): ChatbotService {
    if (!ChatbotService.instance) {
      ChatbotService.instance = new ChatbotService();
    }
    return ChatbotService.instance;
  }

  /**
   * Initialize system prompt with app context
   */
  private initializeSystemPrompt(): void {
    const systemPrompt: ChatMessage = {
      role: 'assistant',
      content: `You are a helpful AI assistant for PetSit Connect, a pet sitting mobile app platform. 
You can help users with:
- Booking information and how to book a pet sitter
- Understanding payment and pricing
- Profile management
- Troubleshooting common issues
- General questions about pet sitting services

Contact Information:
- Phone: 09639283365
- Email: petsitconnectph@gmail.com

Note: PetSit Connect is a mobile app only - we do not have a website. All services are available through the mobile app.

How to Become a Pet Sitter:
If users ask about becoming a pet sitter, explain the process:
1. Sign up for an account on PetSit Connect mobile app
2. Select "Pet Sitter" as your role during registration
3. Complete your profile and provide a primary ID (government-issued identification)
4. Submit your verification documents
5. Wait for admin approval - the admin will review your application
6. Once approved, you can start accepting pet sitting bookings

Important: Always provide the email address (petsitconnectph@gmail.com) when users ask about:
- Becoming a pet sitter
- Contact information
- Support or help
- Any inquiries about PetSit Connect

If users ask for contact information, phone number, email, or how to reach PetSit Connect support, always provide:
- Phone: 09639283365
- Email: petsitconnectph@gmail.com

If users ask about a website, inform them that PetSit Connect is a mobile app only and does not have a website. All services are available through the mobile app.

Be friendly, concise, and helpful. If you don't know something, politely say so.`,
      timestamp: new Date(),
    };
    
    // Add system prompt at the start of conversation history
    if (this.conversationHistory.length === 0) {
      this.conversationHistory.push(systemPrompt);
    }
  }

  /**
   * Load chatbot configuration from AsyncStorage
   */
  private async loadConfig(): Promise<void> {
    try {
      const savedConfig = await AsyncStorage.getItem('chatbot_config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        
        // If using Gemini, automatically switch to Groq (Gemini has quota issues)
        if (config.provider === 'gemini') {
          console.log('🔄 Detected Gemini config - switching to Groq...');
          const groqConfig: ChatbotConfig = {
            provider: 'groq',
            apiKey: '', // User must configure API key in app settings
            model: 'llama-3.1-8b-instant',
          };
          await this.setConfig(groqConfig);
          this.config = groqConfig;
          console.log('✅ Switched to Groq');
        } else {
          // Ensure config has a valid model name
          if (!config.model) {
            if (config.provider === 'groq') {
              config.model = 'llama-3.1-8b-instant';
            } else if (config.provider === 'huggingface') {
              config.model = 'mistralai/Mistral-7B-Instruct-v0.2';
            } else if (config.provider === 'openai') {
              config.model = 'gpt-3.5-turbo';
            }
            await this.setConfig(config);
          }
          this.config = config;
        }
      }
    } catch (error) {
      console.error('Failed to load chatbot config:', error);
    }
  }

  /**
   * Save chatbot configuration
   */
  public async setConfig(config: ChatbotConfig): Promise<void> {
    try {
      this.config = config;
      await AsyncStorage.setItem('chatbot_config', JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save chatbot config:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): ChatbotConfig | null {
    return this.config;
  }

  /**
   * Test API key and list available models
   */
  public async testApiKey(): Promise<{ success: boolean; models?: string[]; error?: string }> {
    if (!this.config?.apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    const apiVersions = ['v1beta', 'v1'];
    
    // Try to list available models from both API versions
    for (const apiVersion of apiVersions) {
      try {
        console.log(`🧪 Testing API key with ${apiVersion}...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${this.config.apiKey}`
        );

        if (response.ok) {
          const data = await response.json();
          const models = data.models?.map((m: any) => {
            // Extract model name (could be "models/gemini-pro" or just "gemini-pro")
            const name = m.name || '';
            return name.replace('models/', '');
          }).filter((name: string) => name) || [];
          
          console.log(`✅ API key works with ${apiVersion}! Available models:`, models);
          return { success: true, models };
        } else {
          const errorText = await response.text();
          console.log(`❌ ${apiVersion} failed: ${response.status} - ${errorText}`);
          // Continue to next API version
        }
      } catch (error) {
        console.log(`❌ ${apiVersion} error:`, error);
        // Continue to next API version
        continue;
      }
    }

    return { 
      success: false, 
      error: 'Unable to connect to Gemini API. Please verify your API key is correct.' 
    };
  }

  /**
   * Clear conversation history
   */
  public clearHistory(): void {
    this.conversationHistory = [];
    this.initializeSystemPrompt();
  }

  /**
   * Reset configuration (useful for fixing config issues)
   */
  public async resetConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem('chatbot_config');
      this.config = null;
      await this.autoConfigure();
      console.log('✅ Chatbot config reset successfully');
    } catch (error) {
      console.error('Failed to reset chatbot config:', error);
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  public getHistory(): ChatMessage[] {
    return this.conversationHistory.slice(1); // Exclude system prompt
  }

  /**
   * Send a message to the AI chatbot
   */
  public async sendMessage(message: string): Promise<string> {
    // Ensure config is loaded and fixed
    if (!this.config) {
      await this.loadConfig();
      await this.autoConfigure();
    }
    
    // Double-check config exists
    if (!this.config) {
      throw new Error('Chatbot not configured. Please set API key and provider first.');
    }
    
    // Ensure config is using Groq (not Gemini which has quota issues)
    if (this.config.provider === 'gemini') {
      console.log('🔄 Detected Gemini provider - switching to Groq...');
      this.config = {
        provider: 'groq',
        apiKey: '', // User must configure API key in app settings
        model: 'llama-3.1-8b-instant',
      };
      await this.setConfig(this.config);
    }
    
    // Ensure model is set
    if (!this.config.model) {
      if (this.config.provider === 'groq') {
        this.config.model = 'llama-3.1-8b-instant';
      } else if (this.config.provider === 'huggingface') {
        this.config.model = 'mistralai/Mistral-7B-Instruct-v0.2';
      } else if (this.config.provider === 'openai') {
        this.config.model = 'gpt-3.5-turbo';
      }
      await this.setConfig(this.config);
    }

    // Add user message to history
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    this.conversationHistory.push(userMessage);

    try {
      let response: string;

      switch (this.config.provider) {
        case 'gemini':
          response = await this.callGeminiAPI(message);
          break;
        case 'huggingface':
          response = await this.callHuggingFaceAPI(message);
          break;
        case 'openai':
          response = await this.callOpenAIAPI(message);
          break;
        case 'groq':
          response = await this.callGroqAPI(message);
          break;
        default:
          throw new Error(`Unsupported provider: ${this.config.provider}`);
      }

      // Add assistant response to history
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      this.conversationHistory.push(assistantMessage);

      // Keep only last MAX_HISTORY messages (excluding system prompt)
      if (this.conversationHistory.length > this.MAX_HISTORY + 1) {
        this.conversationHistory = [
          this.conversationHistory[0], // Keep system prompt
          ...this.conversationHistory.slice(-this.MAX_HISTORY),
        ];
      }

      return response;
    } catch (error) {
      console.error('Chatbot error:', error);
      throw error;
    }
  }

  /**
   * Google Gemini API Integration
   * Free tier: 15 RPM, 1,500 requests/day
   * Get API key: https://aistudio.google.com/apikey
   */
  private async callGeminiAPI(message: string): Promise<string> {
    if (!this.config?.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    // First, try to list available models to see what's actually accessible
    try {
      console.log('🔍 Checking available models for your API key...');
      const testResult = await this.testApiKey();
      if (testResult.success && testResult.models && testResult.models.length > 0) {
        console.log('✅ Available models:', testResult.models);
        // Use available models first
        const availableModels = testResult.models.filter((m: string) => 
          m.includes('flash') || m.includes('pro') || m.includes('gemini')
        );
        if (availableModels.length > 0) {
          // Prioritize available models
          const modelsToTry = [
            ...availableModels,
            'gemini-2.0-flash-lite',
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            'gemini-1.5-pro-latest',
            'gemini-1.5-pro',
            'gemini-pro',
          ];
          
          // Remove duplicates and try them
          const uniqueModels = Array.from(new Set(modelsToTry));
          return await this.tryModelsWithVersions(uniqueModels, message);
        }
      } else {
        console.log('⚠️ Could not list models, will try common free tier models');
      }
    } catch (error) {
      console.log('⚠️ Model listing failed, trying common models:', error);
    }

    // Fallback: try common free tier models
    const modelsToTry = [
      'gemini-2.0-flash-lite',  // Latest free tier model (2026)
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
      'gemini-pro',  // Fallback
    ];
    
    return await this.tryModelsWithVersions(modelsToTry, message);
  }

  /**
   * Try models with different API versions
   */
  private async tryModelsWithVersions(modelsToTry: string[], message: string): Promise<string> {
    if (!this.config?.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Prepare conversation history for Gemini (excluding system prompt)
    const conversationParts = this.conversationHistory.slice(1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));
    
    // For AI Studio keys, try v1beta first (most common), then v1
    const apiVersions = ['v1beta', 'v1'];

    let lastError: any = null;
    let lastErrorDetails: string = '';

    // Try each API version and model combination
    for (const apiVersion of apiVersions) {
      for (const model of modelsToTry) {
        try {
          console.log(`🔄 Trying model: ${model} with API ${apiVersion}...`);
          
          // Correct URL format: v1beta/models/MODEL_NAME:generateContent
          const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${this.config.apiKey}`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: conversationParts,
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
              console.log(`✅ Successfully used model: ${model} with API ${apiVersion}`);
              // Save working model for future use
              if (this.config && this.config.model !== model) {
                this.config.model = model;
                await this.setConfig(this.config);
              }
              return text;
            }
          } else {
            const errorText = await response.text();
            let errorData: any = {};
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { message: errorText };
            }
            
            lastError = { model, apiVersion, status: response.status, error: errorData };
            lastErrorDetails = errorData?.error?.message || errorData?.message || errorText || 'Unknown error';
            
            console.log(`❌ Model ${model} with API ${apiVersion} failed: ${response.status}`);
            console.log(`   Error details: ${lastErrorDetails}`);
            
            // Check for quota/billing issues
            if (lastErrorDetails.toLowerCase().includes('quota') || 
                lastErrorDetails.toLowerCase().includes('billing') ||
                lastErrorDetails.toLowerCase().includes('unavailable') ||
                response.status === 403) {
              throw new Error(
                `Gemini API quota unavailable. Your API key shows "Set up billing" status which may indicate:\n` +
                `1. Regional restrictions - Gemini API may not be available in your region\n` +
                `2. Free tier quota exhausted - Check your usage limits\n` +
                `3. API key restrictions - Verify the key is active and has proper permissions\n\n` +
                `Error: ${lastErrorDetails}\n` +
                `Status: ${response.status}`
              );
            }
            
            // If it's not a 404, don't try other models (it's likely an auth issue)
            if (response.status !== 404 && response.status !== 400) {
              throw new Error(`Gemini API error: ${response.status} - ${lastErrorDetails}`);
            }
          }
        } catch (error) {
          lastError = error;
          if (error instanceof Error) {
            lastErrorDetails = error.message;
            // If it's a quota/billing error, throw it immediately
            if (error.message.includes('quota') || error.message.includes('billing')) {
              throw error;
            }
          }
          console.log(`❌ Model ${model} with API ${apiVersion} error:`, error);
          // Continue to next model/version
          continue;
        }
      }
    }

    // If all models failed, throw error with details
    const errorMessage = lastErrorDetails || lastError?.error?.message || lastError?.message || 'Unknown error';
    
    // Check if it's a quota/billing issue
    if (errorMessage.toLowerCase().includes('quota') || 
        errorMessage.toLowerCase().includes('billing') ||
        errorMessage.toLowerCase().includes('unavailable')) {
      throw new Error(
        `Gemini API quota unavailable. Your API key shows "Set up billing" status.\n\n` +
        `Possible solutions:\n` +
        `1. Check if Gemini API is available in your region\n` +
        `2. Try using a different API key\n` +
        `3. Verify your API key is active at: https://aistudio.google.com/apikey\n` +
        `4. Check if free tier quota has been exhausted\n\n` +
        `Last error: ${errorMessage}`
      );
    }
    
    throw new Error(
      `All Gemini models failed. Last error: ${errorMessage}. ` +
      `Tried models: ${modelsToTry.join(', ')} with API versions: ${apiVersions.join(', ')}. ` +
      `Please verify your API key is valid and has access to Gemini models. ` +
      `You can check available models at: https://aistudio.google.com/apikey`
    );
  }

  /**
   * Hugging Face Inference API Integration
   * Free tier: 30 requests/minute
   * Models: meta-llama/Llama-2-7b-chat-hf, mistralai/Mistral-7B-Instruct-v0.2
   * Get API key: https://huggingface.co/settings/tokens
   */
  private async callHuggingFaceAPI(message: string): Promise<string> {
    if (!this.config?.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    const model = this.config.model || 'mistralai/Mistral-7B-Instruct-v0.2';

    // Format conversation for Hugging Face
    let prompt = this.conversationHistory
      .slice(1) // Exclude system prompt
      .map(msg => {
        if (msg.role === 'user') {
          return `[INST] ${msg.content} [/INST]`;
        }
        return msg.content;
      })
      .join('\n');

    if (!prompt.endsWith('[/INST]')) {
      prompt += '\n[INST] ' + message + ' [/INST]';
    }

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 512,
            temperature: 0.7,
            return_full_text: false,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    if (Array.isArray(data) && data[0]?.generated_text) {
      return data[0].generated_text.trim();
    } else if (data.generated_text) {
      return data.generated_text.trim();
    }

    throw new Error('Invalid response format from Hugging Face API');
  }

  /**
   * OpenAI API Integration
   * Free tier: $5 credit/month (expires after 3 months)
   * Get API key: https://platform.openai.com/api-keys
   */
  private async callOpenAIAPI(message: string): Promise<string> {
    if (!this.config?.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const model = this.config.model || 'gpt-3.5-turbo';

    // Format conversation for OpenAI (exclude system prompt, use it as system message)
    const systemPrompt = this.conversationHistory[0]?.content || '';
    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory.slice(1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('No response text from OpenAI API');
    }

    return text;
  }

  /**
   * Groq API Integration
   * Free tier: Very generous, no credit card required
   * Fast inference with open-source models
   * Get API key: https://console.groq.com/
   */
  private async callGroqAPI(message: string): Promise<string> {
    if (!this.config?.apiKey) {
      throw new Error('Groq API key not configured');
    }

    const model = this.config.model || 'llama-3.1-8b-instant'; // Fast and free

    // Format conversation for Groq (similar to OpenAI)
    const systemPrompt = this.conversationHistory[0]?.content || '';
    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory.slice(1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('No response text from Groq API');
    }

    return text;
  }
}

// Export singleton instance
export const chatbotService = ChatbotService.getInstance();
export type { ChatbotConfig, ChatMessage };

