import { useNavigate } from "@solidjs/router";
import { createEffect, createSignal, For } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea,
} from "../../components/ui/text-field";
import { useAuth } from "../../lib/auth";
import type { MeProfile, PatchMePayload } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { OnboardingLayout } from "./OnboardingLayout";

const PHONE_LIKE_RE = /^[0-9+\-\s()]+$/;

function splitDisplayName(displayName: string | null | undefined) {
  const parts = (displayName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeTelegramInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function supportsProfileNameFields(profileForm: MeProfile["profileForm"] | undefined) {
  return Boolean(
    profileForm &&
      typeof profileForm === "object" &&
      Object.prototype.hasOwnProperty.call(profileForm, "firstName") &&
      Object.prototype.hasOwnProperty.call(profileForm, "lastName"),
  );
}

export function OnboardingProfile() {
  const auth = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [fieldError, setFieldError] = createSignal<string | null>(null);
  const [hydratedFromProfile, setHydratedFromProfile] = createSignal(false);

  const [firstName, setFirstName] = createSignal("");
  const [lastName, setLastName] = createSignal("");
  const [aboutMe, setAboutMe] = createSignal("");
  const [telegram, setTelegram] = createSignal("");
  const [socialLinks, setSocialLinks] = createSignal<string[]>([]);

  createEffect(() => {
    const me = auth.me();
    if (!me || hydratedFromProfile()) return;

    const fallbackName = splitDisplayName(me.displayName);
    setFirstName(me.profileForm?.firstName || fallbackName.firstName);
    setLastName(me.profileForm?.lastName || fallbackName.lastName);
    setAboutMe(me.profileForm?.aboutMe || me.profileForm?.notes || "");
    setTelegram(me.profileForm?.telegram || "");
    setSocialLinks(
      me.profileForm?.socialLinks?.length
        ? me.profileForm.socialLinks
        : me.profileForm?.socialUrl
          ? [me.profileForm.socialUrl || ""]
          : [],
    );
    setHydratedFromProfile(true);
  });

  const cleanedSocialLinks = () =>
    socialLinks()
      .map((value) => value.trim())
      .filter(Boolean);

  const validate = () => {
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
      const trimmedFirstName = firstName().trim();
      const trimmedLastName = lastName().trim();
      const displayName = [trimmedFirstName, trimmedLastName].filter(Boolean).join(" ");
      const payload: PatchMePayload = {
        profileForm: {
          aboutMe: aboutMe().trim(),
          submitted: true,
          telegram: normalizeTelegramInput(telegram()) || null,
          socialLinks: cleanedSocialLinks(),
          socialUrl: cleanedSocialLinks()[0] || null,
        },
      };

      if (supportsProfileNameFields(auth.me()?.profileForm)) {
        payload.profileForm = {
          ...payload.profileForm,
          firstName: trimmedFirstName || null,
          lastName: trimmedLastName || null,
        };
      } else if (displayName) {
        payload.displayName = displayName;
      }

      await auth.patchMe(payload);
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
    >
      <SectionCard
        title={t("student.onboarding.profile.cardTitle")}
        class="rounded-[calc(var(--radius-lg)+8px)] border-0 bg-white shadow-card"
      >
        <div class="grid gap-5">
          <p class="text-sm leading-7 text-muted-foreground">
            {t("student.onboarding.profile.subtitle")}
          </p>
          <div class="grid gap-5 md:grid-cols-2">
            <TextField class="grid gap-2">
              <TextFieldLabel for="onb-first-name">
                {t("student.onboarding.profile.firstNameLabel")}
              </TextFieldLabel>
              <TextFieldInput
                id="onb-first-name"
                value={firstName()}
                onInput={(event) => setFirstName(event.currentTarget.value)}
                placeholder={t("student.onboarding.profile.firstNamePlaceholder")}
                disabled={saving()}
                autocomplete="given-name"
              />
            </TextField>
            <TextField class="grid gap-2">
              <TextFieldLabel for="onb-last-name">
                {t("student.onboarding.profile.lastNameLabel")}
              </TextFieldLabel>
              <TextFieldInput
                id="onb-last-name"
                value={lastName()}
                onInput={(event) => setLastName(event.currentTarget.value)}
                placeholder={t("student.onboarding.profile.lastNamePlaceholder")}
                disabled={saving()}
                autocomplete="family-name"
              />
            </TextField>
          </div>
          <TextField class="grid gap-2">
            <TextFieldLabel for="onb-email">
              {t("student.onboarding.profile.emailLabel")}
            </TextFieldLabel>
              <TextFieldInput
                id="onb-email"
                type="email"
                value={auth.me()?.email || ""}
                readOnly
                disabled
                autocomplete="email"
            />
          </TextField>
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
