// Bridge between the pre-registration funnel and the account: right after
// login the draft is sent once to PATCH /api/me and then cleared.

import { apiFetch } from "../../lib/api";
import { getOnboardingPlan } from "../../lib/publicOnboardingApi";
import { clearDraft, readDraft, toYoutubeOnboardingPayload } from "./startDraft";

export type SyncResult = "synced" | "empty" | "failed";

export async function syncDraftToMe(): Promise<SyncResult> {
  const draft = readDraft();
  const youtubeOnboarding = toYoutubeOnboardingPayload(draft);
  if (!youtubeOnboarding) return "empty";

  let goalId: string | null = null;
  let courseIds: string[] = [];
  try {
    const plan = await getOnboardingPlan({
      goal: draft.goalSlug,
      format: draft.format,
    });
    goalId = plan.goal.id || null;
    courseIds = plan.courses.map((course) => course.id);
  } catch {
    // The goal lookup is a convenience: without it the student lands on the
    // existing goal step instead of losing the answers collected so far.
  }

  const payload: Record<string, unknown> = { youtubeOnboarding };
  if (goalId) payload.selectedGoalId = goalId;
  // Students without a channel buy the whole path; the expert picks lessons
  // for the others later, so nothing is preselected for them.
  if (!youtubeOnboarding.hasChannel) {
    const known = new Set(courseIds);
    const chosenCourses = draft.selectedCourses.filter((id) => known.has(id));
    const chosenLessons = draft.selectedLessons.filter(
      (item) => known.has(item.courseId) && !chosenCourses.includes(item.courseId),
    );
    if (chosenCourses.length > 0 || chosenLessons.length > 0) {
      payload.selectedCourses = chosenCourses;
      if (chosenLessons.length > 0) payload.selectedLessons = chosenLessons;
      payload.subscriptionSelected = true;
    } else if (courseIds.length > 0) {
      payload.selectedCourses = courseIds;
      payload.subscriptionSelected = true;
    }
  }

  try {
    const response = await apiFetch("/api/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!response.ok) return "failed";
  } catch {
    return "failed";
  }

  clearDraft();
  return "synced";
}
