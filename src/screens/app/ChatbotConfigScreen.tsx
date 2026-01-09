import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { chatbotService, ChatbotConfig } from '../../services/chatbotService';

const ChatbotConfigScreen: React.FC = () => {
  const router = useRouter();
  const [provider, setProvider] = useState<'gemini' | 'huggingface' | 'openai'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadCurrentConfig();
  }, []);

  useEffect(() => {
    // Set default model based on provider
    if (!model) {
      switch (provider) {
        case 'gemini':
          setModel('gemini-1.5-flash'); // Best model for free tier
          break;
        case 'huggingface':
          setModel('mistralai/Mistral-7B-Instruct-v0.2');
          break;
        case 'openai':
          setModel('gpt-3.5-turbo');
          break;
        case 'groq':
          setModel('llama-3.1-8b-instant'); // Fast and free
          break;
      }
    }
  }, [provider]);

  const loadCurrentConfig = () => {
    const config = chatbotService.getConfig();
    if (config) {
      setProvider(config.provider);
      setApiKey(config.apiKey);
      setModel(config.model || '');
    }
  };

  const testConnection = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter your API key first');
      return;
    }

    setTesting(true);
    try {
      const testConfig: ChatbotConfig = {
        provider,
        apiKey: apiKey.trim(),
        model: model.trim() || undefined,
      };

      await chatbotService.setConfig(testConfig);
      
      // Test with a simple message
      const response = await chatbotService.sendMessage('Hello');
      
      if (response) {
        Alert.alert(
          'Success!',
          'Chatbot is configured and working correctly.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Test error:', error);
      Alert.alert(
        'Connection Failed',
        error instanceof Error ? error.message : 'Failed to connect to the AI service. Please check your API key.',
        [{ text: 'OK' }]
      );
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter your API key');
      return;
    }

    setLoading(true);
    try {
      const config: ChatbotConfig = {
        provider,
        apiKey: apiKey.trim(),
        model: model.trim() || undefined,
      };

      await chatbotService.setConfig(config);
      Alert.alert(
        'Configuration Saved',
        'Your chatbot configuration has been saved successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert(
        'Error',
        'Failed to save configuration. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const getProviderInfo = () => {
    switch (provider) {
      case 'gemini':
        return {
          name: 'Google Gemini',
          freeTier: '15 RPM, 1,500 requests/day',
          getKeyUrl: 'https://aistudio.google.com/apikey',
          description: 'Recommended: Best free tier with excellent performance',
        };
      case 'huggingface':
        return {
          name: 'Hugging Face',
          freeTier: '30 requests/minute',
          getKeyUrl: 'https://huggingface.co/settings/tokens',
          description: 'Open source models, no credit card required',
        };
      case 'openai':
        return {
          name: 'OpenAI',
          freeTier: '$5 credit/month (expires after 3 months)',
          getKeyUrl: 'https://platform.openai.com/api-keys',
          description: 'Reliable and well-documented',
        };
      case 'groq':
        return {
          name: 'Groq',
          freeTier: 'Very generous free tier',
          getKeyUrl: 'https://console.groq.com/',
          description: 'Fast & free, no credit card required',
        };
      default:
        return {
          name: '',
          freeTier: '',
          getKeyUrl: '',
          description: '',
        };
    }
  };

  const providerInfo = getProviderInfo();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chatbot Configuration</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose AI Provider</Text>
          <Text style={styles.sectionDescription}>
            Select your preferred AI chatbot provider
          </Text>

          {(['gemini', 'huggingface', 'openai', 'groq'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.providerCard,
                provider === p && styles.providerCardSelected,
              ]}
              onPress={() => setProvider(p)}
            >
              <View style={styles.providerCardContent}>
                <View style={styles.providerCardHeader}>
                  <Text style={styles.providerCardTitle}>
                    {p === 'gemini' && 'Google Gemini'}
                    {p === 'huggingface' && 'Hugging Face'}
                    {p === 'openai' && 'OpenAI'}
                    {p === 'groq' && 'Groq'}
                  </Text>
                  {provider === p && (
                    <Ionicons name="checkmark-circle" size={24} color="#F59E0B" />
                  )}
                </View>
                {provider === p && (
                  <Text style={styles.providerCardDescription}>
                    {p === 'gemini' &&
                      'Recommended: Best free tier with excellent performance'}
                    {p === 'huggingface' &&
                      'Open source models, no credit card required'}
                    {p === 'openai' &&
                      'Reliable and well-documented'}
                    {p === 'groq' &&
                      'Fast & free, no credit card required'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Provider Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Provider:</Text>
              <Text style={styles.infoValue}>{providerInfo.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Free Tier:</Text>
              <Text style={styles.infoValue}>{providerInfo.freeTier}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Description:</Text>
              <Text style={styles.infoValue}>{providerInfo.description}</Text>
            </View>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                // In a real app, you'd open the URL
                Alert.alert(
                  'Get API Key',
                  `Visit: ${providerInfo.getKeyUrl}\n\nCopy your API key and paste it below.`,
                  [{ text: 'OK' }]
                );
              }}
            >
              <Ionicons name="link-outline" size={20} color="#F59E0B" />
              <Text style={styles.linkButtonText}>Get API Key</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Configuration</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>API Key *</Text>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Enter your API key"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Model (Optional)</Text>
            <TextInput
              style={styles.input}
              value={model}
              onChangeText={setModel}
              placeholder={
                provider === 'gemini'
                  ? 'gemini-1.5-flash (default)'
                  : provider === 'huggingface'
                  ? 'mistralai/Mistral-7B-Instruct-v0.2 (default)'
                  : provider === 'openai'
                  ? 'gpt-3.5-turbo (default)'
                  : provider === 'groq'
                  ? 'llama-3.1-8b-instant (default)'
                  : 'model name'
              }
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inputHint}>
              Leave empty to use the default model
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.testButton, testing && styles.buttonDisabled]}
            onPress={testConnection}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Test Connection</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
            onPress={saveConfig}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Save Configuration</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  providerCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  providerCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBF0',
  },
  providerCardContent: {
    flex: 1,
  },
  providerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  providerCardDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  linkButtonText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: '#3B82F6',
  },
  saveButton: {
    backgroundColor: '#F59E0B',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
});

export default ChatbotConfigScreen;

