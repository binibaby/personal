# Google Gemini AI Chatbot Setup Guide

## Step 1: Get Your Google Gemini API Key

Since you're already on the Google Gemini website:

1. **Go to Google AI Studio**: https://aistudio.google.com/apikey
   - If you haven't already, sign in with your Google account

2. **Create API Key**:
   - Click on "Get API Key" or "Create API Key"
   - Select a Google Cloud project (or create a new one)
   - Click "Create API Key in new project" or use existing project
   - Copy your API key (it will look like: `AIzaSy...`)

3. **Important Notes**:
   - ✅ Free tier: **15 requests/minute, 1,500 requests/day**
   - ✅ No credit card required initially (for free tier)
   - ✅ Keep your API key secure - don't share it publicly
   - ✅ You can create multiple API keys for different projects

## Step 2: Configure in Your App

### Option A: Using the Configuration Screen (Recommended)

1. **Open your app**
2. **Navigate to the Chatbot Config screen**:
   ```typescript
   // You can navigate to it from anywhere:
   router.push('/chatbot-config');
   ```

3. **Configure the chatbot**:
   - Select "Google Gemini" as provider
   - Paste your API key in the "API Key" field
   - Model: Leave as default (`gemini-1.5-flash`) or change if needed
   - Click "Test Connection" to verify it works
   - Click "Save Configuration"

### Option B: Programmatically (For Testing)

You can also configure it directly in code:

```typescript
import { chatbotService } from '../services/chatbotService';

// Configure Google Gemini
await chatbotService.setConfig({
  provider: 'gemini',
  apiKey: 'YOUR_API_KEY_HERE', // Replace with your actual API key
  model: 'gemini-1.5-flash', // Optional, this is the default
});

// Test it
const response = await chatbotService.sendMessage('Hello!');
console.log('AI Response:', response);
```

## Step 3: Use the Chatbot in Your App

### Navigate to Chat Screen

```typescript
import { useRouter } from 'expo-router';

const router = useRouter();

// Navigate to chat screen
router.push('/ai-chat');
```

### Use the Service Directly

```typescript
import { chatbotService } from '../services/chatbotService';

// Send a message
try {
  const response = await chatbotService.sendMessage(
    "What services do you offer on PetSitter Connect?"
  );
  console.log('AI Response:', response);
} catch (error) {
  console.error('Error:', error);
}

// Get conversation history
const history = chatbotService.getHistory();

// Clear conversation
chatbotService.clearHistory();
```

## Step 4: Add Chat Button to Your App

You can add a chat button to any screen, for example in your dashboard:

```typescript
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const router = useRouter();

// In your component
<TouchableOpacity
  onPress={() => router.push('/ai-chat')}
  style={styles.chatButton}
>
  <Ionicons name="chatbubble-ellipses-outline" size={24} color="#F59E0B" />
  <Text>AI Assistant</Text>
</TouchableOpacity>
```

## Available Gemini Models

- **gemini-1.5-flash** (Default) - Fast and free, perfect for chat
- **gemini-1.5-pro** - More capable, slightly slower (if you upgrade)
- **gemini-pro** - Previous generation (still works)

## Troubleshooting

### "API key not configured"
- Make sure you've set the config using `chatbotService.setConfig()`
- Check that your API key is correct

### "API error: 403"
- Your API key might be invalid
- Check if you've enabled the Gemini API in Google Cloud Console
- Make sure you haven't exceeded the free tier limits

### "API error: 429"
- You've exceeded the rate limit (15 requests/minute)
- Wait a minute and try again

### "Network error"
- Check your internet connection
- Verify the API endpoint is accessible

## Free Tier Limits

- ✅ **Rate Limit**: 15 requests per minute
- ✅ **Daily Limit**: 1,500 requests per day
- ✅ **No cost** for free tier usage
- ⚠️ If you exceed these limits, you'll need to wait or upgrade

## Next Steps

1. ✅ Get your API key from Google AI Studio
2. ✅ Configure it in the app using the config screen
3. ✅ Test it by navigating to `/ai-chat`
4. ✅ Add a chat button to your main screens
5. ✅ Customize the system prompt in `chatbotService.ts` if needed

## Example: Adding to Dashboard

Here's how you could add it to your pet owner dashboard:

```typescript
// In your dashboard component
<TouchableOpacity
  style={styles.card}
  onPress={() => router.push('/ai-chat')}
>
  <Ionicons name="chatbubble-ellipses" size={32} color="#F59E0B" />
  <Text style={styles.cardTitle}>AI Assistant</Text>
  <Text style={styles.cardDescription}>
    Get help with bookings, payments, and more
  </Text>
</TouchableOpacity>
```

Enjoy your AI chatbot! 🚀

