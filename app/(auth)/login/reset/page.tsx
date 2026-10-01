import { SURFACE } from "@/lib/consumer/surface";
import { ResetPasswordPage } from "@/components/consumer/auth/ResetPasswordPage";

export default function Page() {
  if (SURFACE === "doctor") {
    return (
      <ResetPasswordPage
        title="Choose a new password"
        subtitle="This signs you in on this device and signs out every other session."
        blurb="VersaLife Health for doctors. Manage availability, consult patients, and grow your practice."
        afterResetHref="/dashboard"
      />
    );
  }
  return (
    <ResetPasswordPage
      title="Choose a new password"
      subtitle="This signs you in on this device and signs out every other session."
      afterResetHref="/home"
    />
  );
}
