import React from "react";

import { HomeTemplate } from "@/components/templates";
import type { HomeTemplateProps } from "@/types/home";

const homeProps: HomeTemplateProps = {
  hero: {
    title: "Today Matters",
    timestamp: "Friday, November 8 · 12:32PM",
    subtitle: "Stay rooted, stay productive",
    actions: [
      { id: "search", icon: "search" },
      { id: "focus", icon: "zap" },
      { id: "share", icon: "share-2" },
      { id: "profile", icon: "user" },
    ],
    avatarName: "Today Matters",
  },
  verse: {
    title: "Verse of the Day",
    reference: "Proverbs 3:5-6",
    highlight: "Trust in the Lord with all your heart and lean not on your own understanding.",
    fullText:
      "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.",
  },
  nextSteps: {
    sectionTitle: "What's Next",
    buttonLabel: "Perfect time for prayer & reflection",
    event: {
      title: "Meeting with Cole",
      timeUntil: "in 32 min",
      attendees: "Jake, Mark, Warren and 12 others",
      statusDetail: "Verse of the Day kickoff via Zoom",
    },
    reminder: "You have 32 minutes until your next event.",
    suggestions: [
      { id: "big3", text: 'You have room to finish "Big 3 #2: Finish Q4 Strategy Deck"' },
      { id: "comms", text: "Catch up on 4 pending communications" },
      { id: "sarah", text: "Send that message to Sarah" },
    ],
    actionCardTitle: "Hot Communications & Actions",
    actionCardSubtitle: "Triage the most important follow-ups",
  },
  bigThree: [
    { id: "1", title: "Complete Q4 Strategy Presentation", status: "completed" },
    { id: "2", title: "Finish Q4 Strategy Deck", status: "pending" },
    { id: "3", title: "Review and Approve Marketing Budget", status: "pending" },
  ],
  communications: [
    {
      id: "c1",
      sender: "Connor Chamberlin",
      subject: "Follow up from planning meeting",
      timeAgo: "2 hours ago",
    },
    {
      id: "c2",
      sender: "Grady Delmar",
      subject: "Re: Team Meeting Tomorrow - Agenda",
      timeAgo: "3 hours ago",
    },
    {
      id: "c3",
      sender: "Jake Oswald",
      subject: "Revised Schedule and Plan",
      timeAgo: "4 hours ago",
    },
    {
      id: "c4",
      sender: "Sergy Alim",
      subject: "Core Lead - Completed Successfully",
      timeAgo: "5 hours ago",
    },
  ],
  daySegments: [
    { id: "doc", time: "12pm", label: "Document Review", duration: "30 min", status: "upcoming", accent: "#a48dff" },
    { id: "lunch", time: "12pm", label: "Lunch", duration: "30 min", status: "current", accent: "#f8b133" },
    { id: "walk", time: "12:30pm", label: "Walk", duration: "30 min", accent: "#748cff" },
    { id: "1pm", time: "1pm", label: "—", duration: "", accent: "#d5d8e8" },
    { id: "2pm", time: "2pm", label: "—", duration: "", accent: "#d5d8e8" },
    { id: "3pm", time: "3pm", label: "—", duration: "", accent: "#d5d8e8" },
  ],
};

export default function HomePage() {
  return <HomeTemplate {...homeProps} />;
}
