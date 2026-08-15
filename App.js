import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { colors, fonts } from './src/theme';

import HomeScreen from './src/screens/HomeScreen';
import AnalyzingScreen from './src/screens/AnalyzingScreen';
import ResultScreen from './src/screens/ResultScreen';
import HistoryScreen from './src/screens/HistoryScreen';

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
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
          headerTintColor: colors.text,
          headerBackTitle: 'Geri',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Analyzing"
          component={AnalyzingScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Denetim Raporu' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Denetim Geçmişi' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
