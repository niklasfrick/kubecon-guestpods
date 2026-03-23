import { useState } from "preact/hooks";
import { submitEntry, SubmissionError } from "../api";
import { formState, appView } from "../app";
import { TextInput } from "./TextInput";
import { CountrySelect } from "./CountrySelect";
import { HomelabScale } from "./HomelabScale";
import { SubmitButton } from "./SubmitButton";
import { ErrorBanner } from "./ErrorBanner";

export function SubmissionForm() {
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [homelabLevel, setHomelabLevel] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);

  const isSubmitting = formState.value === "submitting";
  const allFieldsValid =
    name.trim().length > 0 && countryCode !== "" && homelabLevel !== null;

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setBannerError(null);

    // Client-side validation
    const errors: Record<string, string> = {};
    if (name.trim().length === 0) {
      errors.name = "Enter your name to join the cluster";
    } else if ([...name.trim()].length > 30) {
      errors.name = "Name must be 30 characters or fewer";
    }
    if (countryCode === "") {
      errors.country_code = "Select where you're from";
    }
    if (homelabLevel === null) {
      errors.homelab_level = "Pick your homelab level";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    formState.value = "submitting";
    setFieldErrors({});

    try {
      const response = await submitEntry({
        name: name.trim(),
        country_code: countryCode,
        homelab_level: homelabLevel!,
      });

      localStorage.setItem("guestbook_submission", JSON.stringify(response));
      appView.value = 'viz';
    } catch (err) {
      formState.value = "form";

      if (err instanceof SubmissionError) {
        if (err.status === 403) {
          // Submissions closed while form was open — switch to viz
          appView.value = 'viz';
          return;
        }
        if (err.status === 422) {
          // Profanity rejection
          setFieldErrors({
            name: "That name wasn't accepted. Try a different one.",
          });
        } else if (err.field) {
          setFieldErrors({ [err.field]: err.message });
        } else if (err.status >= 500) {
          setBannerError("Something went wrong. Try again in a moment.");
        } else {
          setBannerError(err.message);
        }
      } else {
        setBannerError(
          "Couldn't reach the server. Check your connection and try again.",
        );
      }
    }
  }

  return (
    <div class="card">
      <div class="form-brand">
        <h1 class="form-title">Guestpods</h1>
        <p class="form-subtitle">KubeCon 2026</p>
      </div>
      {bannerError && (
        <ErrorBanner
          message={bannerError}
          onDismiss={() => setBannerError(null)}
        />
      )}
      <form onSubmit={handleSubmit}>
        <div class="form-fields">
          <TextInput
            label="Your name"
            name="name"
            required
            maxLength={30}
            placeholder="Enter your name"
            value={name}
            error={fieldErrors.name}
            disabled={isSubmitting}
            onInput={(v) => {
              setName(v);
              clearFieldError("name");
            }}
            autoFocus
          />
          <CountrySelect
            label="Where are you from?"
            value={countryCode}
            onChange={(v) => {
              setCountryCode(v);
              clearFieldError("country_code");
            }}
            disabled={isSubmitting}
            error={fieldErrors.country_code}
          />
          <HomelabScale
            value={homelabLevel}
            onChange={(v) => {
              setHomelabLevel(v);
              clearFieldError("homelab_level");
            }}
            disabled={isSubmitting}
          />
          <SubmitButton
            loading={isSubmitting}
            disabled={!allFieldsValid}
          />
        </div>
      </form>
    </div>
  );
}
