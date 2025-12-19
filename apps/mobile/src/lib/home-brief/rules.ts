import type {
  HomeBriefContext,
  HomeBriefDraft,
  HomeBriefReason,
} from './types';
import { stableHashJson } from './hash';
import { addMinutes, clampTextToMaxChars } from './time';

const LINE_MAX_CHARS = 56;

function formatMinutes(mins: number): string {
  if (mins <= 0) return 'now';
  if (mins === 1) return '1 minute';
  if (mins < 60) return `${mins} minutes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`;
  return `${h}h ${m}m`;
}

function computeReason(ctx: HomeBriefContext): HomeBriefReason {
  // Morning wake experience is its own “moment”.
  if (ctx.rhythm.isWakeWindowActive) {
    return 'morningWake';
  }

  // If the user is currently in an event, speak to *that* first.
  if (ctx.schedule.currentEvent) {
    return 'inProgress';
  }

  const minutesUntil = ctx.schedule.minutesUntilNextEvent;
  if (minutesUntil != null) {
    if (minutesUntil === 0) return 'eventStarting';
    if (minutesUntil > 0 && minutesUntil <= 10) return 'nextEventSoon';
  }

  if (ctx.reviewTime.unassignedCount > 0) {
    return 'reviewTimeNudge';
  }

  if (ctx.goals.pendingTasksCount > 0) {
    return 'goalNudge';
  }

  if (ctx.now.bucket === 'evening' || ctx.now.bucket === 'night') {
    return 'dayWrap';
  }

  return 'default';
}

function computeMomentKey(reason: HomeBriefReason, ctx: HomeBriefContext): string {
  const nextEventId = ctx.schedule.nextEvent?.id ?? 'none';
  const currentEventId = ctx.schedule.currentEvent?.id ?? 'none';
  return [
    reason,
    `bucket:${ctx.now.bucket}`,
    `cur:${currentEventId}`,
    `next:${nextEventId}`,
    `unassigned:${ctx.reviewTime.unassignedCount}`,
    `pending:${ctx.goals.pendingTasksCount}`,
  ].join('|');
}

function daysAlive(birthdayYmd: string, now: Date): number | null {
  const match = birthdayYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [_, y, m, d] = match;
  const birth = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(birth.getTime())) return null;

  // Compare at local midnight to avoid DST artifacts.
  const start = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  if (diffDays < 0) return null;

  // “Nth day of your life” is 1-indexed.
  return diffDays + 1;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function buildLines(
  reason: HomeBriefReason,
  ctx: HomeBriefContext,
  nowDate: Date
): { line1: string; line2: string; line3?: string } {
  const next = ctx.schedule.nextEvent;
  const minutesUntil = ctx.schedule.minutesUntilNextEvent;
  const current = ctx.schedule.currentEvent;
  const minutesRemainingCurrent =
    current != null ? Math.max(0, current.startMinutes + current.duration - ctx.now.minutesFromMidnight) : null;

  // Morning always starts with “This is the …”
  if (reason === 'morningWake') {
    const n = ctx.profile.birthday ? daysAlive(ctx.profile.birthday, nowDate) : null;
    const dayLine = n ? `This is the ${ordinal(n)} day of your life.` : `This is your morning.`;

    if (next && minutesUntil != null) {
      return {
        line1: dayLine,
        line2:
          minutesUntil <= 0
            ? `First up: ${next.title}.`
            : `You have ${formatMinutes(minutesUntil)} until ${next.title}.`,
      };
    }

    if (ctx.goals.pendingTasksCount > 0) {
      return {
        line1: dayLine,
        line2: `What’s one small win you want today?`,
      };
    }

    return {
      line1: dayLine,
      line2: `How do you want to feel by lunchtime?`,
    };
  }

  if (reason === 'inProgress' && current && minutesRemainingCurrent != null) {
    const title = current.title;
    const cat = (current.category ?? '').toLowerCase();
    const isDeepWork = cat === 'work' && /deep\\s*work/i.test(title);
    const isMeal = cat === 'meal';

    if (isDeepWork || current.isBig3) {
      // Don’t mention “Lunch” explicitly while in deep work; speak in terms of time remaining/break.
      const line1 = isDeepWork ? `Deep work — ${formatMinutes(minutesRemainingCurrent)} left.` : `${title} — ${formatMinutes(minutesRemainingCurrent)} left.`;
      const line2 = `One deliverable. No tabs. No inbox.`;

      if (next && minutesUntil != null && minutesUntil <= 10) {
        const nextCat = (next.category ?? '').toLowerCase();
        const line3 = nextCat === 'meal' ? `Break in ${formatMinutes(minutesUntil)}.` : `Next: ${next.title} in ${formatMinutes(minutesUntil)}.`;
        return { line1, line2, line3 };
      }

      return { line1, line2 };
    }

    if (isMeal) {
      return {
        line1: `${title} — ${formatMinutes(minutesRemainingCurrent)} left.`,
        line2: `Step away. No screens. Reset your brain.`,
      };
    }

    // Generic in-progress
    return {
      line1: `${title} — ${formatMinutes(minutesRemainingCurrent)} left.`,
      line2: `Stay with it. Finish the next small piece.`,
    };
  }

  if ((reason === 'nextEventSoon' || reason === 'eventStarting') && next && minutesUntil != null) {
    return {
      line1:
        minutesUntil <= 0
          ? `It’s time for ${next.title}.`
          : `You have ${formatMinutes(minutesUntil)} until ${next.title}.`,
      line2: next.isBig3 ? `What’s the one outcome you want?` : `Anything to prep before you go in?`,
    };
  }

  if (reason === 'reviewTimeNudge' && ctx.reviewTime.unassignedCount > 0) {
    const count = ctx.reviewTime.unassignedCount;
    return {
      line1: `Quick check-in: ${count} block${count === 1 ? '' : 's'} to label.`,
      line2: `Label them now—your day gets clearer fast.`,
    };
  }

  if (reason === 'goalNudge' && ctx.goals.pendingTasksCount > 0) {
    const top = ctx.goals.topGoalTitle;
    return {
      line1: top ? `10 minutes on “${top}”.` : `10 minutes on a goal.`,
      line2: `Start with the smallest next step.`,
    };
  }

  if (reason === 'dayWrap') {
    const completed = ctx.goals.completedTasksCount;
    return {
      line1: `Before you wrap up…`,
      line2: completed > 0 ? `Nice work today. Set tomorrow’s first move?` : `Anything you want to do differently tomorrow?`,
    };
  }

  // Default
  if (next && minutesUntil != null) {
    return {
      line1: `You have ${formatMinutes(minutesUntil)} until ${next.title}.`,
      line2: `Use this window for one small win.`,
    };
  }

  return {
    line1: `What would make today feel like a win?`,
    line2: `Pick one thing you can do in 10 minutes.`,
  };
}

function computeExpiryMinutes(reason: HomeBriefReason, ctx: HomeBriefContext): number {
  // Faster refresh for near-term event moments.
  if (reason === 'eventStarting') return 8;
  if (reason === 'nextEventSoon') return 10;

  // While in an event, refresh more frequently so we can pivot at end/start boundaries.
  if (reason === 'inProgress') return 15;

  // If user has review-time items, refresh moderately to avoid nagging.
  if (reason === 'reviewTimeNudge') return 30;

  // Morning can stay a bit longer.
  if (reason === 'morningWake') return 45;

  // Default
  if (ctx.now.bucket === 'evening' || ctx.now.bucket === 'night') return 45;
  return 30;
}

export function generateHomeBriefDraft(ctx: HomeBriefContext, nowDate: Date): HomeBriefDraft {
  const reason = computeReason(ctx);
  const momentKey = computeMomentKey(reason, ctx);

  // Only hash the pieces we actually want to affect regeneration.
  const contextHash = stableHashJson({
    momentKey,
    birthday: ctx.profile.birthday ?? null,
    currentEventId: ctx.schedule.currentEvent?.id ?? null,
    nextEventId: ctx.schedule.nextEvent?.id ?? null,
    minutesUntilNextEvent: ctx.schedule.minutesUntilNextEvent ?? null,
    unassignedCount: ctx.reviewTime.unassignedCount,
    pendingTasksCount: ctx.goals.pendingTasksCount,
    coachPersona: ctx.persona.coachPersona ?? null,
    morningMindset: ctx.persona.morningMindset ?? null,
    focusStyle: ctx.persona.focusStyle ?? null,
  });

  const built = buildLines(reason, ctx, nowDate) as unknown as { line1: string; line2: string; line3?: string };

  const expiryMins = computeExpiryMinutes(reason, ctx);
  const expiresAt = addMinutes(nowDate, expiryMins).toISOString();

  return {
    line1: clampTextToMaxChars(built.line1, LINE_MAX_CHARS),
    line2: clampTextToMaxChars(built.line2, LINE_MAX_CHARS),
    line3: built.line3 ? clampTextToMaxChars(built.line3, LINE_MAX_CHARS) : undefined,
    reason,
    momentKey,
    expiresAt,
    contextHash,
  };
}

