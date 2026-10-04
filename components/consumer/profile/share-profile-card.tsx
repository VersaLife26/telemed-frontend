"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";

import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import {
  doctorPublicUrl,
  doctorShareBioLine,
  doctorShareDescription,
  patientAppHost,
} from "@/lib/consumer/features/doctor-share";

type ShareProfileCardProps = {
  doctorId: string;
  displayName: string;
  specialty: string;
  experienceYears: number;
  feeLabel: string;
  bio: string;
  photoSrc: string;
  active: boolean;
};

export function ShareProfileCard({
  doctorId,
  displayName,
  specialty,
  experienceYears,
  feeLabel,
  bio,
  photoSrc,
  active,
}: ShareProfileCardProps) {
  const url = doctorPublicUrl(doctorId);
  const description = doctorShareDescription({
    specialty,
    experienceYears,
    feeLabel,
    bio,
  });
  const bioLine = doctorShareBioLine(bio);
  const [qr, setQr] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(url, {
          width: 512,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0c3d86", light: "#ffffff" },
        }),
      )
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [active, url]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copied");
    } catch {
      setNotice("Select the link and copy it");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: displayName, text: description, url });
      setNotice("Share sheet opened");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      await copy();
    }
  }

  function downloadQr() {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = qr;
    link.download = "versalife-profile-qr.png";
    link.click();
  }

  if (!active) {
    return (
      <Card>
        <h2 className="text-h4 text-ink">Share your profile</h2>
        <p className="mt-2 text-body-sm text-muted">
          Sharing is available while your profile is active. Patients cannot open a suspended profile.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-h4 text-ink">Share your profile</h2>
      <p className="mt-1 text-body-sm text-muted">
        Patients who scan the code or open the link land on your public profile and can book a visit.
      </p>

      <div className="mt-5 overflow-hidden rounded-xl border border-border-default bg-surface">
        <div className="flex gap-4 p-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-tint">
            <Image src={photoSrc} alt="" fill className="object-cover" unoptimized />
          </div>
          <div className="min-w-0">
            <p className="text-label text-brand">VersaLife Health</p>
            <p className="truncate text-h4 text-ink">{displayName}</p>
            {specialty && specialty !== "—" ? (
              <p className="truncate text-body-sm text-muted">{specialty}</p>
            ) : null}
            <p className="text-body-sm text-ink">
              {feeLabel}
              {experienceYears > 0 ? ` · ${experienceYears} yrs` : ""}
            </p>
            {bioLine ? <p className="mt-1 line-clamp-2 text-body-sm text-muted">{bioLine}</p> : null}
          </div>
        </div>
        <p className="truncate border-t border-border-subtle px-4 py-2 text-body-sm text-muted">
          {patientAppHost()}/doctors/{doctorId}
        </p>
      </div>

      <div className="mt-5 flex flex-col items-center gap-3">
        {qr ? (
          // The QR is a data URL drawn in the browser. next/image rejects those.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt={`QR code for ${displayName}'s public profile`}
            width={180}
            height={180}
            className="rounded-lg border border-border-subtle bg-white p-2"
          />
        ) : (
          <div className="size-[180px] animate-pulse rounded-lg bg-tint" aria-hidden="true" />
        )}
        <label htmlFor="doctor-share-url" className="sr-only">
          Profile link
        </label>
        <input
          id="doctor-share-url"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-lg border border-border-default bg-tint px-3 py-2 text-body-sm text-ink"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" leading={<Copy className="size-4" />} onClick={() => void copy()}>
          Copy link
        </Button>
        {canShare ? (
          <Button size="sm" variant="outline" leading={<Share2 className="size-4" />} onClick={() => void share()}>
            Share
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          leading={<Download className="size-4" />}
          disabled={!qr}
          onClick={downloadQr}
        >
          Download QR
        </Button>
      </div>
      {notice ? (
        <p className="mt-3 text-body-sm text-brand" role="status">
          {notice}
        </p>
      ) : null}
    </Card>
  );
}
