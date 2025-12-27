import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { Smartphone, RefreshCcw, ShieldAlert } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Icon } from '@/components/atoms';
import { BottomToolbar } from '@/components/organisms/BottomToolbar';

interface TopAppRow {
  id: string;
  name: string;
  durationLabel: string;
  durationSeconds: number;
}

interface ScreenTimeAnalyticsTemplateProps {
  totalLabel: string;
  topApps: TopAppRow[];
  statusLabel: string;
  canRequestAuthorization: boolean;
  canRefresh: boolean;
  onRequestAuthorization: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const SectionHeader = ({ icon, title }: { icon: LucideIcon; title: string }) => (
  <View className="flex-row items-center gap-2">
    <View className="h-9 w-9 items-center justify-center rounded-2xl bg-slate-900">
      <Icon icon={icon} size={18} color="#fff" />
    </View>
    <Text className="text-base font-semibold text-white">{title}</Text>
  </View>
);

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export const ScreenTimeAnalyticsTemplate = ({
  totalLabel,
  topApps,
  statusLabel,
  canRequestAuthorization,
  canRefresh,
  onRequestAuthorization,
  onRefresh,
  isRefreshing,
}: ScreenTimeAnalyticsTemplateProps) => {
  const insets = useSafeAreaInsets();

  const maxSeconds = Math.max(...topApps.map((app) => app.durationSeconds), 1);
  const isRefreshDisabled = !canRefresh || isRefreshing;
  const isAuthorizationDisabled = !canRequestAuthorization;

  return (
    <SafeAreaView className="flex-1 bg-slate-950" style={{ flex: 1, paddingTop: insets.top }}>
      <LinearGradient
        colors={['#0b1220', '#020617']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 112 }}
        >
          <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Demo Mode</Text>
          <Text className="mt-2 text-3xl font-semibold text-white">Digital Wellbeing</Text>
          <Text className="mt-2 text-sm text-slate-300">Today’s Screen Time + top apps, styled like our current analytics.</Text>

          <View className="mt-6">
            <Card className="bg-white/5 border border-white/10">
              <SectionHeader icon={Smartphone} title="Today’s Screen Time" />

              <Text className="mt-4 text-5xl font-semibold text-white">{totalLabel}</Text>
              <Text className="mt-2 text-sm text-slate-300">{statusLabel}</Text>

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={onRequestAuthorization}
                  disabled={isAuthorizationDisabled}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3"
                  style={({ pressed }) => [{ opacity: isAuthorizationDisabled ? 0.6 : pressed ? 0.92 : 1 }]}
                >
                  <Icon icon={ShieldAlert} size={18} color="#fff" />
                  <Text className="text-sm font-semibold text-white">Allow Screen Time</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={onRefresh}
                  disabled={isRefreshDisabled}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3"
                  style={({ pressed }) => [
                    { opacity: isRefreshDisabled ? 0.6 : pressed ? 0.92 : 1 },
                  ]}
                >
                  <Icon icon={RefreshCcw} size={18} color="#fff" />
                  <Text className="text-sm font-semibold text-white">{isRefreshing ? 'Refreshing…' : 'Refresh'}</Text>
                </Pressable>
              </View>
            </Card>
          </View>

          <View className="mt-6">
            <Card className="bg-white/5 border border-white/10">
              <Text className="text-base font-semibold text-white">Top Apps</Text>
              <Text className="mt-1 text-sm text-slate-300">Your biggest attention sinks today.</Text>

              <View className="mt-4 gap-3">
                {topApps.length === 0 ? (
                  <Text className="text-sm text-slate-400">No report data yet. Tap Refresh to generate today’s report.</Text>
                ) : (
                  topApps.map((app) => {
                    const percent = app.durationSeconds / maxSeconds;
                    return (
                      <View key={app.id} className="gap-2">
                        <View className="flex-row items-baseline justify-between">
                          <Text className="text-sm font-semibold text-white">{app.name}</Text>
                          <Text className="text-xs font-semibold text-slate-300">
                            {app.durationLabel} · {formatPercent(percent)}
                          </Text>
                        </View>
                        <View className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <View className="h-2 rounded-full bg-blue-500" style={{ width: `${percent * 100}%` }} />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </Card>
          </View>
        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0">
          <BottomToolbar />
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};


