import { useNavigate } from "@solidjs/router";
import { createSignal, For } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea,
} from "../../components/ui/text-field";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { OnboardingLayout } from "./OnboardingLayout";

const PHONE_LIKE_RE = /^[0-9+\-\s()]+$/;

function normalizeTelegramInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function OnboardingProfile() {
  const auth = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [fieldError, setFieldError] = createSignal<string | null>(null);

  const [aboutMe, setAboutMe] = createSignal(
    auth.me()?.profileForm?.aboutMe || auth.me()?.profileForm?.notes || "",
  );
  const [telegram, setTelegram] = createSignal(auth.me()?.profileForm?.telegram || "");
  const [socialLinks, setSocialLinks] = createSignal<string[]>(
    auth.me()?.profileForm?.socialLinks?.length
      ? auth.me()?.profileForm?.socialLinks!
      : auth.me()?.profileForm?.socialUrl
        ? [auth.me()?.profileForm?.socialUrl || ""]
        : [],
  );

  const cleanedSocialLinks = () =>
    socialLinks()
      .map((value) => value.trim())
      .filter(Boolean);

  const validate = () => {
    if (!aboutMe().trim()) return t("student.onboarding.profile.aboutMeRequired");
    const telegramValue = telegram().trim();
    if (telegramValue) {
      const normalized = telegramValue.startsWith("@")
        ? telegramValue.slice(1)
        : telegramValue;
      if (!telegramValue.startsWith("http") && PHONE_LIKE_RE.test(normalized)) {
        return t("student.onboarding.profile.telegramPhoneError");
      }
    }
    for (const link of cleanedSocialLinks()) {
      try {
        const parsed = new URL(link);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return t("student.onboarding.profile.socialLinkError");
        }
      } catch {
        return t("student.onboarding.profile.socialLinkError");
      }
    }
    return null;
  };

  const save = async (): Promise<boolean> => {
    const validation = validate();
    if (validation) {
      setFieldError(validation);
      return false;
    }
    setSaving(true);
    setError(null);
    setFieldError(null);
    try {
      await auth.patchMe({
        profileForm: {
          aboutMe: aboutMe().trim(),
          notes: aboutMe().trim(),
          telegram: normalizeTelegramInput(telegram()) || null,
          socialLinks: cleanedSocialLinks(),
          socialUrl: cleanedSocialLinks()[0] || null,
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
      void navigate("/onboarding/goal");
    }
  };

  return (
    <OnboardingLayout
      step="profile"
      title={t("student.onboarding.profile.title")}
      subtitle={t("student.onboarding.profile.subtitle")}
    >
      <SectionCard
        title={t("student.onboarding.profile.cardTitle")}
        description={t("student.onboarding.profile.cardDescription")}
        class="rounded-[calc(var(--radius-lg)+8px)] border-0 bg-white shadow-card"
      >
        <div class="grid gap-5">
          <TextField class="grid gap-2">
            <TextFieldLabel for="onb-about">
              {t("student.onboarding.profile.aboutMeLabel")}
            </TextFieldLabel>
            <TextFieldTextArea
              id="onb-about"
              class="min-h-[180px]"
              value={aboutMe()}
              onInput={(event) => setAboutMe(event.currentTarget.value)}
              placeholder={t("student.onboarding.profile.aboutMePlaceholder")}
              disabled={saving()}
            />
          </TextField>
          <TextField class="grid gap-2">
            <TextFieldLabel for="onb-telegram">
              {t("student.onboarding.profile.telegramLabel")}
            </TextFieldLabel>
            <TextFieldInput
              id="onb-telegram"
              value={telegram()}
              onInput={(event) => setTelegram(normalizeTelegramInput(event.currentTarget.value))}
              placeholder={t("student.onboarding.profile.telegramPlaceholder")}
              disabled={saving()}
            />
            <p class="text-xs text-muted-foreground">
              {t("student.onboarding.profile.telegramHelp")}
            </p>
          </TextField>
          <div class="grid gap-3">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-medium leading-none">
                {t("student.onboarding.profile.socialLinksLabel")}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSocialLinks((current) => [...current, ""])}
                disabled={saving()}
              >
                {t("student.onboarding.profile.addSocialLink")}
              </Button>
            </div>
            <For each={socialLinks()}>
              {(value, index) => (
                <div class="flex items-center gap-2">
                  <TextField class="flex-1">
                    <TextFieldInput
                      value={value}
                      onInput={(event) =>
                        setSocialLinks((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index() ? event.currentTarget.value : item,
                          ),
                        )}
                      placeholder={t("student.onboarding.profile.socialLinkPlaceholder")}
                      disabled={saving()}
                    />
                  </TextField>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setSocialLinks((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index()),
                      )}
                    disabled={saving()}
                    aria-label={t("student.onboarding.profile.removeSocialLink")}
                  >
                    <span class="material-symbols-outlined text-[18px]">close</span>
                  </Button>
                </div>
              )}
            </For>
          </div>
          <div class="rounded-[var(--radius-md)] border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            {t("student.onboarding.profile.disclaimer")}
          </div>
          <div class="flex flex-wrap gap-2">
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
          {fieldError() ? (
            <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
              {fieldError()}
            </div>
          ) : null}
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
