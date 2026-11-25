import { useNavigate } from "@solidjs/router";
import { createEffect, createSignal, Index, Show } from "solid-js";

import { Icon } from "../../components/ui/icon";
import { useAuth } from "../../lib/auth";
import type { MeProfile, PatchMePayload } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { ButtonRow, StartButton, StartError, StartInput } from "../start/StartUi";
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
    if (!telegramValue) {
      return t("student.onboarding.profile.telegramRequired");
    }
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
    if (!ok) return;
    // Students who already had a channel get their path from a live expert,
    // so they skip course selection and checkout.
    const isExpert = auth.me()?.youtubeOnboarding?.track === "expert";
    void navigate(isExpert ? "/onboarding/expert" : "/onboarding/courses");
  };

  return (
    <OnboardingLayout
      step="profile"
      title={t("student.onboarding.profile.title")}
    >
      <p class="st-lead">{t("student.onboarding.profile.subtitle")}</p>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="st-label" for="onb-first-name">
            {t("student.onboarding.profile.firstNameLabel")}
          </label>
          <StartInput
            id="onb-first-name"
            value={firstName()}
            onInput={(event) => setFirstName(event.currentTarget.value)}
            placeholder={t("student.onboarding.profile.firstNamePlaceholder")}
            disabled={saving()}
            autocomplete="given-name"
          />
        </div>
        <div class="space-y-2">
          <label class="st-label" for="onb-last-name">
            {t("student.onboarding.profile.lastNameLabel")}
          </label>
          <StartInput
            id="onb-last-name"
            value={lastName()}
            onInput={(event) => setLastName(event.currentTarget.value)}
            placeholder={t("student.onboarding.profile.lastNamePlaceholder")}
            disabled={saving()}
            autocomplete="family-name"
          />
        </div>
      </div>

      <div class="space-y-2">
        <label class="st-label" for="onb-email">
          {t("student.onboarding.profile.emailLabel")}
        </label>
        <StartInput
          id="onb-email"
          type="email"
          value={auth.me()?.email || ""}
          readOnly
          disabled
          autocomplete="email"
        />
      </div>

      <div class="space-y-2">
        <label class="st-label" for="onb-about">
          {t("student.onboarding.profile.aboutMeLabel")}
        </label>
        <textarea
          id="onb-about"
          class="st-field st-textarea"
          value={aboutMe()}
          onInput={(event) => setAboutMe(event.currentTarget.value)}
          placeholder={t("student.onboarding.profile.aboutMePlaceholder")}
          disabled={saving()}
        />
      </div>

      <div class="space-y-2">
        <label class="st-label" for="onb-telegram">
          {t("student.onboarding.profile.telegramLabel")}{" "}
          <span class="text-red-600" aria-hidden="true">
            *
          </span>
        </label>
        <StartInput
          id="onb-telegram"
          value={telegram()}
          onInput={(event) => setTelegram(normalizeTelegramInput(event.currentTarget.value))}
          placeholder={t("student.onboarding.profile.telegramPlaceholder")}
          disabled={saving()}
          required
          aria-required="true"
        />
        <p class="text-xs text-[var(--st-muted)]">
          {t("student.onboarding.profile.telegramHelp")}
        </p>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="st-label">{t("student.onboarding.profile.socialLinksLabel")}</div>
          <StartButton
            variant="small"
            onClick={() => setSocialLinks((current) => [...current, ""])}
            disabled={saving()}
          >
            {t("student.onboarding.profile.addSocialLink")}
          </StartButton>
        </div>
        <Index each={socialLinks()}>
          {(value, index) => (
            <div class="flex items-center gap-2">
              <StartInput
                value={value()}
                onInput={(event) =>
                  setSocialLinks((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? event.currentTarget.value : item,
                    ),
                  )
                }
                placeholder={t("student.onboarding.profile.socialLinkPlaceholder")}
                disabled={saving()}
              />
              <button
                type="button"
                class="st-icon-btn"
                onClick={() =>
                  setSocialLinks((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                disabled={saving()}
                aria-label={t("student.onboarding.profile.removeSocialLink")}
              >
                <Icon name="close" class="text-[18px]" />
              </button>
            </div>
          )}
        </Index>
      </div>

      <Show when={fieldError()}>
        <StartError>{fieldError()}</StartError>
      </Show>
      <Show when={error()}>
        <StartError>{error()}</StartError>
      </Show>

      <ButtonRow>
        <StartButton
          variant="secondary"
          onClick={() => void navigate("/onboarding/goal")}
          disabled={saving()}
        >
          {t("student.onboarding.profile.back")}
        </StartButton>
        <StartButton variant="secondary" onClick={() => void save()} disabled={saving()}>
          {saving()
            ? t("student.onboarding.common.saving")
            : t("student.onboarding.profile.submit")}
        </StartButton>
        <StartButton onClick={() => void next()} disabled={saving()}>
          {saving()
            ? t("student.onboarding.common.saving")
            : t("student.onboarding.profile.next")}
        </StartButton>
      </ButtonRow>
    </OnboardingLayout>
  );
}
