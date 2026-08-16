import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from './src/theme';
import { t } from './src/i18n';

import OnboardingScreen, { ONBOARDING_KEY } from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import AnalyzingScreen from './src/screens/AnalyzingScreen';
import ResultScreen from './src/screens/ResultScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import { initPurchases } from './src/api/purchases';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    primary: colors.cyan,
    border: colors.line,
  },
};

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    initPurchases().catch(() => {});
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((done) => setInitialRoute(done ? 'Home' : 'Onboarding'))
      .catch(() => setInitialRoute('Onboarding'));
  }, []);

  // Flag okunana kadar zemin renginde boş ekran — splash'tan yumuşak geçiş.
  if (!initialRoute) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
          headerTintColor: colors.text,
          headerBackTitle: t('nav.back'),
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Analyzing"
          component={AnalyzingScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: t('nav.report') }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: t('nav.history') }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('nav.settings') }} />
        <Stack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{ title: t('nav.pro'), presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}