import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui';
import { useColors } from '@/theme';

export default function TabLayout() {
  const { t } = useTranslation();
  const c = useColors();

  const addHolding = () => (
    <IconButton icon="add-circle" label={t('forms.newHolding')} onPress={() => router.push('/holding/edit')} />
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: c.text },
        headerRightContainerStyle: { paddingRight: 12 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          headerRight: addHolding,
          tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: t('tabs.assets'),
          headerRight: addHolding,
          tabBarIcon: ({ color, size }) => <Ionicons name="layers" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="institutions"
        options={{
          title: t('tabs.institutions'),
          headerRight: () => (
            <IconButton
              icon="add-circle"
              label={t('forms.newInstitution')}
              onPress={() => router.push('/institution/edit')}
            />
          ),
          tabBarIcon: ({ color, size }) => <Ionicons name="business" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
