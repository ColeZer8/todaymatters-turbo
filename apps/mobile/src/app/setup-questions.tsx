import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, InteractionManager, View } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { SetupQuestionsTemplate } from "@/components/templates";
import { useAuthStore } from "@/stores";
import {
  SETUP_SCREENS_STEPS,
  SETUP_SCREENS_TOTAL_STEPS,
} from "@/constants/setup-screens";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useOnboardingSync } from "@/lib/supabase/hooks";
import type { AiSetupResponses } from "@/lib/ai-setup";

const FULL_QUESTIONS: Array<{
  key: keyof AiSetupResponses;
  question: string;
  options: string[];
}> = [
  {
    key: "motivation",
    question: "When things are going well, what matters most to you?",
    options: [
      "Accomplishing meaningful goals",
      "Peace and stability",
      "Helping or supporting others",
      "Being competent and prepared",
      "Being authentic and understood",
      "Being in control and independent",
    ],
  },
  {
    key: "blocker",
    question: "When you feel stuck, what usually holds you back?",
    options: [
      "Overthinking or self-doubt",
      "Fear of letting people down",
      "Lack of clarity or direction",
      "Resistance to being told what to do",
      "Low energy or burnout",
      "Wanting it to be perfect first",
    ],
  },
  {
    key: "action_pace",
    question: "How do you naturally approach action?",
    options: [
      "Fast — I'd rather act and adjust",
      "Steady — I like consistency",
      "Careful — I want the details first",
      "Relational — I think about people first",
    ],
  },
  {
    key: "advice_style",
    question: "When someone gives you advice, you prefer it to be:",
    options: [
      "Direct and to the point",
      "Encouraging and supportive",
      "Thoughtful and well-reasoned",
      "Vision-oriented and inspiring",
    ],
  },
  {
    key: "decision_style",
    question: "When you're making an important decision, you usually rely on:",
    options: [
      "Data and logic",
      "Intuition or gut feel",
      "Trusted people",
      "Past experience",
    ],
  },
  {
    key: "accountability_style",
    question: "What kind of accountability helps you most?",
    options: [
      "Clear goals and deadlines",
      "Gentle reminders and encouragement",
      "Reflection and self-awareness",
      "Freedom with occasional check-ins",
    ],
  },
  {
    key: "stress_response",
    question: "When life gets overwhelming, you tend to:",
    options: [
      "Push harder",
      "Pull back",
      "Get anxious or scattered",
      "Shut down emotionally",
    ],
  },
  {
    key: "recovery_preference",
    question: "What usually helps you get back on track?",
    options: [
      "Clear next steps",
      "Someone believing in me",
      "Time to think or journal",
      'A strong reminder of my "why"',
    ],
  },
  {
    key: "coaching_contract",
    question:
      "If Today Matters could coach you one way, which would you choose?",
    options: [
      "Challenge me when I'm making excuses",
      "Encourage me when I'm discouraged",
      "Help me think clearly",
      "Keep me focused on what matters most",
    ],
  },
  {
    key: "conversation_tone",
    question: "How should Today Matters talk to you?",
    options: [
      "Straight shooter",
      "Friendly guide",
      "Thought partner",
      "Coach with a little humor",
    ],
  },
];

const FAST_TRACK_OPTIONS = [
  "I like winning and making progress.",
  "I like harmony and steady momentum.",
  "I like understanding things deeply.",
  "I like helping people succeed.",
  "I like freedom and flexibility.",
  "I like being prepared and right.",
];

export default function SetupQuestionsScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady =
    navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const aiSetupResponses = useOnboardingStore(
    (state) => state.aiSetupResponses,
  );
  const setAiSetupResponse = useOnboardingStore(
    (state) => state.setAiSetupResponse,
  );

  const { saveAiSetupResponses } = useOnboardingSync({
    autoLoad: false,
    autoSave: false,
  });
  const [mode, setMode] = useState<"full" | "fast">(() =>
    aiSetupResponses.fast_track ? "fast" : "full",
  );
  const [questionIndex, setQuestionIndex] = useState(0);

  const activeQuestion = useMemo(
    () => FULL_QUESTIONS[questionIndex],
    [questionIndex],
  );
  const selectedOption =
    mode === "fast"
      ? (aiSetupResponses.fast_track ?? null)
      : ((aiSetupResponses[activeQuestion?.key] as string | null | undefined) ??
        null);

  const questionLabel =
    mode === "fast"
      ? "Quick profile"
      : `Question ${questionIndex + 1} of ${FULL_QUESTIONS.length}`;
  const questionText =
    mode === "fast"
      ? "Which statement sounds most like you?"
      : (activeQuestion?.question ?? "");
  const options =
    mode === "fast" ? FAST_TRACK_OPTIONS : (activeQuestion?.options ?? []);
  const switchLabel =
    mode === "fast"
      ? "Want more detail? Answer the full set."
      : "Short on time? Use the 1-question shortcut.";

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    const timeoutId = setTimeout(() => {
      void saveAiSetupResponses(aiSetupResponses);
    }, 700);
    return () => clearTimeout(timeoutId);
  }, [aiSetupResponses, hasHydrated, isAuthenticated, saveAiSetupResponses]);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace("/");
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const handleSelect = (value: string) => {
    if (mode === "fast") {
      setAiSetupResponse("fast_track", value);
      return;
    }
    if (!activeQuestion) return;
    setAiSetupResponse(activeQuestion.key, value);
  };

  const handleContinue = () => {
    void saveAiSetupResponses(aiSetupResponses);
    if (mode === "full" && questionIndex < FULL_QUESTIONS.length - 1) {
      setQuestionIndex((prev) => prev + 1);
      return;
    }
    router.replace("/big3-opt-in");
  };

  const handleBack = () => {
    if (mode === "full" && questionIndex > 0) {
      setQuestionIndex((prev) => prev - 1);
      return;
    }
    router.replace("/my-church");
  };

  const handleSwitchMode = () => {
    if (mode === "fast") {
      setAiSetupResponse("fast_track", null);
      setMode("full");
      setQuestionIndex(0);
      return;
    }
    setMode("fast");
  };

  return (
    <SetupQuestionsTemplate
      step={SETUP_SCREENS_STEPS.setupQuestions}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
      mode={mode}
      title="AI Coach Setup"
      subtitle="Tell us how you operate so we can coach you well."
      questionLabel={questionLabel}
      question={questionText}
      options={options}
      selectedOption={selectedOption}
      onSelect={handleSelect}
      onContinue={handleContinue}
      onBack={handleBack}
      onSwitchMode={handleSwitchMode}
      isContinueDisabled={!selectedOption}
      switchLabel={switchLabel}
    />
  );
}
