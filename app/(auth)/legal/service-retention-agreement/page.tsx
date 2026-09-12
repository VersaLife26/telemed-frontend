import Link from "next/link";
import { AuthFooterLink, AuthHeading, AuthLayout } from "@/components/consumer/layout/AuthLayout";

export default function ServiceRetentionAgreementPage() {
  return (
    <AuthLayout scroll blurb="VersaLife for doctors. The terms that govern how consultation fees are retained and paid.">
      <div className="flex w-full flex-col gap-6">
        <AuthHeading
          title={
            <>
              <p>Service retention</p>
              <p>agreement</p>
            </>
          }
          subtitle="Please read this agreement before you apply to practise on VersaLife."
        />

        <div className="flex flex-col gap-4 text-body text-text-muted">
          <p>
            This VersaLife Service Retention Agreement sets out how consultation fees collected
            through the platform are held, the portion VersaLife retains for operating the
            service, and the portion paid to you as the consulting doctor.
          </p>
          <p>
            By selecting Accept on the doctor registration form you confirm that you have read
            these terms and agree to be bound by them if your application is approved.
          </p>
          <h2 className="text-[16px] font-medium text-black">1. Parties</h2>
          <p>
            VersaLife operates the telemedicine platform. You are a medical practitioner
            registered (or applying to be registered) with the Sri Lanka Medical Council who
            wishes to offer consultations to patients through the platform.
          </p>
          <h2 className="text-[16px] font-medium text-black">2. Retention of service fees</h2>
          <p>
            For each completed, paid consultation, VersaLife retains a platform service fee
            from the amount charged to the patient. The remainder is payable to you. The
            retention rate in force at the time of the consultation applies. Current rates are
            published to approved doctors in the earnings area of the doctor portal and may be
            updated with notice.
          </p>
          <h2 className="text-[16px] font-medium text-black">3. Your consultation fee</h2>
          <p>
            You tell us how much you require per consultation and how much you would like to
            charge. VersaLife may discuss or adjust the listed patient-facing fee before your
            profile is published. You will not be listed at a fee you have not agreed.
          </p>
          <h2 className="text-[16px] font-medium text-black">4. Payouts</h2>
          <p>
            Payouts are made to the bank account you submit with this application. You must
            keep those details accurate. VersaLife is not responsible for delay or loss caused
            by incorrect account information.
          </p>
          <h2 className="text-[16px] font-medium text-black">5. Professional obligations</h2>
          <p>
            You remain solely responsible for clinical care, SLMC registration, and any
            specialist board certification you claim. VersaLife does not practise medicine.
            You will not consult on the platform if your registration lapses or is suspended.
          </p>
          <h2 className="text-[16px] font-medium text-black">6. Records and privacy</h2>
          <p>
            Clinical notes, prescriptions and recordings created on the platform are retained
            as required by law and VersaLife&apos;s record-keeping policy. You must not export
            or store patient information outside the platform except as the law requires.
          </p>
          <h2 className="text-[16px] font-medium text-black">7. Ending the agreement</h2>
          <p>
            Either party may end this arrangement on written notice. Fees already earned for
            completed consultations remain payable. Outstanding applications or consultations
            are handled under the platform&apos;s cancellation and no-show rules.
          </p>
          <p>
            If you do not accept these terms you cannot complete doctor registration.
          </p>
        </div>

        <Link href="/register" className="text-primary">
          Back to registration
        </Link>
        <AuthFooterLink text="Already approved?" linkText="Sign in" href="/login" />
      </div>
    </AuthLayout>
  );
}
