export type HeaderIcon =
  | "search"
  | "bell"
  | "zap"
  | "users"
  | "gift"
  | "calendar"
  | "share-2"
  | "user";

export interface HeaderAction {
  id: string;
  icon: HeaderIcon;
  badge?: string;
}

export interface HeroContent {
  title: string;
  timestamp: string;
  subtitle: string;
  avatarName: string;
  actions: HeaderAction[];
}

export interface VerseContent {
  title: string;
  reference: string;
  highlight: string;
  fullText?: string;
}

export interface NextEvent {
  title: string;
  statusDetail: string;
  timeUntil: string;
  attendees: string;
}

export interface Suggestion {
  id: string;
  text: string;
}

export interface NextStepsContent {
  sectionTitle: string;
  buttonLabel: string;
  event: NextEvent;
  reminder: string;
  suggestions: Suggestion[];
  actionCardTitle: string;
  actionCardSubtitle: string;
}

export interface BigThreeItem {
  id: string;
  title: string;
  status: "completed" | "pending";
}

export interface CommunicationItem {
  id: string;
  sender: string;
  subject: string;
  timeAgo: string;
}

export interface DaySegment {
  id: string;
  time: string;
  label: string;
  duration: string;
  status?: "upcoming" | "current";
  accent: string;
}

export interface HomeTemplateProps {
  hero: HeroContent;
  verse: VerseContent;
  nextSteps: NextStepsContent;
  bigThree: BigThreeItem[];
  communications: CommunicationItem[];
  daySegments: DaySegment[];
}
