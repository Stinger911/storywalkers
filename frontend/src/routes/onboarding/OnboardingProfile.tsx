import { A, useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { OnboardingLayout } from "./OnboardingLayout";

export function OnboardingProfile() {
  const auth = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [telegram, setTelegram] = createSignal(auth.me()?.profileForm?.telegram || "");
  const [socialUrl, setSocialUrl] = createSignal(
    auth.me()?.profileForm?.socialUrl || "",
  );
  const [experienceLevel, setExperienceLevel] = createSignal(
    auth.me()?.profileForm?.experienceLevel || "",
  );
  const [notes, setNotes] = createSignal(auth.me()?.profileForm?.notes || "");

  const save = async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      await auth.patchMe({
        profileForm: {
          telegram: telegram().trim() || null,
          socialUrl: socialUrl().trim() || null,
          experienceLevel:
            (experienceLevel() as "beginner" | "intermediate" | "advanced" | "") || null,
          notes: notes().trim() || null,
        },
      });
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    const ok = await save();
    if (ok) {
      void navigate("/onboarding/courses");
    }
  };

  return (
    <OnboardingLayout
      step="profile"
      title={t("student.onboarding.profile.title")}
      subtitle={t("student.onboarding.profile.subtitle")}
    >
      <SectionCard title={t("student.onboarding.profile.cardTitle")}>
        <div class="grid gap-4">
          <TextField class="grid gap-2">
            <TextFieldLabel for="onb-telegram">
              {t("student.onboarding.profile.telegramLabel")}
            </TextFieldLabel>
            <TextFieldInput
              id="onb-telegram"
              value={telegram()}
              onInput={(event) => setTelegram(event.currentTarget.value)}
              placeholder={t("student.onboarding.profile.telegramPlaceholder")}
            />
          </TextField>
          <TextField class="grid gap-2">
            <TextFieldLabel for="onb-social">
              {t("student.onboarding.profile.socialUrlLabel")}
            </TextFieldLabel>
            <TextFieldInput
              id="onb-social"
              value={socialUrl()}
              onInput={(event) => setSocialUrl(event.currentTarget.value)}
              placeholder={t("student.onboarding.profile.socialUrlPlaceholder")}
            />
          </TextField>
          <div class="grid gap-2">
            <label class="text-sm font-medium" for="onb-experience">
              {t("student.onboarding.profile.experienceLevelLabel")}
            </label>
            <select
              id="onb-experience"
              class="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={experienceLevel()}
              onChange={(event) => setExperienceLevel(event.currentTarget.value)}
            >
              <option value="">
                {t("student.onboarding.profile.experienceLevelPlaceholder")}
              </option>
              <option value="beginner">
                {t("student.onboarding.profile.experienceBeginner")}
              </option>
              <option value="intermediate">
                {t("student.onboarding.profile.experienceIntermediate")}
              </option>
              <option value="advanced">
                {t("student.onboarding.profile.experienceAdvanced")}
              </option>
            </select>
          </div>
          <TextField class="grid gap-2">
            <TextFieldLabel for="onb-notes">
              {t("student.onboarding.profile.notesLabel")}
            </TextFieldLabel>
            <textarea
              id="onb-notes"
              class="min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes()}
              onInput={(event) => setNotes(event.currentTarget.value)}
              placeholder={t("student.onboarding.profile.notesPlaceholder")}
            />
          </TextField>
          <div class="rounded-md border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
            {t("student.onboarding.profile.disclaimer")}
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              as={A}
              href="/onboarding/goal"
              variant="outline"
              disabled={saving()}
            >
              {t("student.onboarding.profile.back")}
            </Button>
            <Button variant="outline" onClick={() => void save()} disabled={saving()}>
              {saving()
                ? t("student.onboarding.common.saving")
                : t("student.onboarding.profile.submit")}
            </Button>
            <Button onClick={() => void next()} disabled={saving()}>
              {saving()
                ? t("student.onboarding.common.saving")
                : t("student.onboarding.profile.next")}
            </Button>
          </div>
          {error() ? (
            <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
              {error()}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </OnboardingLayout>
  );
}
