import React from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { HomeTemplateProps } from "@/types/home";
import {
  CommunicationsCard,
  HeroActionBar,
  NextStepsCard,
  VerseCard,
  BigThreeCard,
  DayOverviewCard,
} from "../organisms";

export function HomeTemplate({
  hero,
  verse,
  nextSteps,
  bigThree,
  communications,
  daySegments,
}: HomeTemplateProps) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#eef2ff]">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <HeroActionBar hero={hero} />
        <View className="gap-4 px-4 pt-5">
          <VerseCard verse={verse} />
          <NextStepsCard nextSteps={nextSteps} />
          <BigThreeCard items={bigThree} />
          <CommunicationsCard items={communications} />
          <DayOverviewCard segments={daySegments} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
