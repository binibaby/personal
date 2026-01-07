import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface EmergencyLocation {
  id: string;
  logo: any;
  address: string;
  phoneNumbers: {
    globe: string[];
    smart: string[];
    landline?: string;
  };
}

const emergencyLocations: EmergencyLocation[] = [
  {
    id: 'dagupan',
    logo: require('../../assets/icons/abc.png'),
    address: '2ND FLOOR DCU BUILDING ARELLANO STREET DAGUPAN CITY',
    phoneNumbers: {
      globe: ['0915-044-0951', '0945-459-2411'],
      smart: ['0929-842-7693'],
      landline: '02-7-255-2529',
    },
  },
  {
    id: 'urdaneta',
    logo: require('../../assets/icons/urdd.png'),
    address: '2ND FLOOR, BARANGAY SAN VICENTE, URDANETA CITY, PANGASINAN',
    phoneNumbers: {
      globe: ['0915-044-0951', '0945-459-2411'],
      smart: ['0929-842-7693'],
      landline: '02-7-255-2529',
    },
  },
  {
    id: 'san-carlos',
    logo: require('../../assets/icons/san.png'),
    address: '2ND FLOOR, UNIT #13, RISING COMMERCIAL SPACE AND APARTMENT, BRGY. BOLINGIT, SAN CARLOS CITY, PANGASINAN',
    phoneNumbers: {
      globe: ['0915-044-0951', '0945-459-2411'],
      smart: ['0929-842-7693'],
      landline: '02-7-255-2529',
    },
  },
  {
    id: 'alaminos',
    logo: require('../../assets/icons/stt.png'),
    address: '6 Yu Bldg., F. Reinoso St. (beside Nepo Mart near Palawan Pawnshop), Alaminos, Philippines',
    phoneNumbers: {
      globe: ['0951-346-4972'],
      smart: [],
    },
  },
];

const EmergencyScreen = () => {
  const router = useRouter();

  const handlePhoneCall = (phoneNumber: string) => {
    const cleanedNumber = phoneNumber.replace(/[-\s]/g, '');
    const phoneUrl = `tel:${cleanedNumber}`;
    Linking.openURL(phoneUrl).catch((err) => {
      console.error('Error opening phone dialer:', err);
      Alert.alert('Error', 'Unable to make phone call. Please dial manually.');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>🚨 Emergency & Inquiries</Text>
          <Text style={styles.introText}>
            For inquiries and in case of emergency, please contact us at any of our locations below.
          </Text>
        </View>

        {emergencyLocations.map((location) => (
          <View key={location.id} style={styles.locationCard}>
            <View style={styles.logoContainer}>
              <Image
                source={location.logo}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.addressLabel}>📍 ADDRESS:</Text>
              <Text style={styles.addressText}>{location.address}</Text>

              <View style={styles.contactSection}>
                <Text style={styles.contactLabel}>
                  📞 FOR INQUIRIES AND IN CASE OF EMERGENCY
                </Text>

                {location.phoneNumbers.globe.length > 0 && (
                  <View style={styles.phoneGroup}>
                    <Text style={styles.phoneLabel}>GLOBE:</Text>
                    {location.phoneNumbers.globe.map((phone, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.phoneButton}
                        onPress={() => handlePhoneCall(phone)}
                      >
                        <Ionicons name="call" size={16} color="#007AFF" />
                        <Text style={styles.phoneText}>{phone}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {location.phoneNumbers.smart.length > 0 && (
                  <View style={styles.phoneGroup}>
                    <Text style={styles.phoneLabel}>SMART:</Text>
                    {location.phoneNumbers.smart.map((phone, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.phoneButton}
                        onPress={() => handlePhoneCall(phone)}
                      >
                        <Ionicons name="call" size={16} color="#007AFF" />
                        <Text style={styles.phoneText}>{phone}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {location.phoneNumbers.landline && (
                  <View style={styles.phoneGroup}>
                    <Text style={styles.phoneLabel}>LANDLINE:</Text>
                    <TouchableOpacity
                      style={styles.phoneButton}
                      onPress={() => handlePhoneCall(location.phoneNumbers.landline!)}
                    >
                      <Ionicons name="call" size={16} color="#007AFF" />
                      <Text style={styles.phoneText}>{location.phoneNumbers.landline}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  introSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
  },
  logo: {
    width: 150,
    height: 80,
  },
  infoSection: {
    marginTop: 8,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  contactSection: {
    marginTop: 8,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  phoneGroup: {
    marginBottom: 12,
  },
  phoneLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e0e8ff',
  },
  phoneText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default EmergencyScreen;

