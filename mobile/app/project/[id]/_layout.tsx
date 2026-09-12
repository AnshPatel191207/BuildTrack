import { Stack } from 'expo-router';
import React from 'react';

export default function ProjectLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="attendance" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="materials" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="expenses" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="tasks" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="reports" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="photos" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="location" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="map" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
