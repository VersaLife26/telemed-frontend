import { SURFACE } from "@/lib/consumer/surface";
import { ForgotPasswordPage } from "@/components/consumer/auth/ForgotPasswordPage";

export default function Page() {
  if (SURFACE === "doctor") {
    return (
      <ForgotPasswordPage
        title="Forgot password"
        subtitle="Enter the email on your doctor profile. We’ll send a reset link if an account exists."
        blurb="VersaLife Health for doctors. Manage availability, consult patients, and grow your practice."
      />
    );
  }
  return (
    <ForgotPasswordPage
      title="Forgot password"
      subtitle="Enter the email you sign in with. We’ll send a reset link if an account exists."
    />
  );
}
