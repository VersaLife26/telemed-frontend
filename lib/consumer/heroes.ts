import { assets } from "@/lib/consumer/assets";

export type HeroQuote = { text: string; author: string };

export type HeroCopy = {
  eyebrow: string;
  title: string;
  lede: string;
  quote: HeroQuote;
  image: string;
};

/**
 * Page hero copy for both consumer surfaces, in one place so the voice stays
 * consistent. Pages whose title is data (a doctor's name, a greeting) override
 * `title`/`eyebrow` at the call site and keep the quote and photo from here.
 */
export const HEROES = {
  home: {
    eyebrow: "Welcome",
    title: "Your partner in health",
    lede: "Video consults with SLMC-registered doctors, from wherever you are.",
    quote: {
      text: "The good physician treats the disease; the great physician treats the patient who has the disease.",
      author: "William Osler",
    },
    image: assets.hero.home,
  },
  doctors: {
    eyebrow: "Find a doctor",
    title: "Care from people who listen",
    lede: "Search by name or specialty, then pick a time that suits you.",
    quote: {
      text: "Wherever the art of medicine is loved, there is also a love of humanity.",
      author: "Hippocrates",
    },
    image: assets.hero.doctors,
  },
  doctorDetail: {
    eyebrow: "Doctor",
    title: "Doctor",
    lede: "",
    quote: {
      text: "To cure sometimes, to relieve often, to comfort always.",
      author: "Edward Trudeau",
    },
    image: assets.hero.doctors,
  },
  booking: {
    eyebrow: "Almost there",
    title: "Confirm your visit",
    lede: "Tell the doctor a little about how you feel, then continue to payment.",
    quote: { text: "The greatest wealth is health.", author: "Virgil" },
    image: assets.hero.booking,
  },
  appointments: {
    eyebrow: "Your visits",
    title: "Appointments",
    lede: "Pay, join, or read a visit summary from here.",
    quote: {
      text: "Take care of your body. It’s the only place you have to live.",
      author: "Jim Rohn",
    },
    image: assets.hero.appointments,
  },
  vault: {
    eyebrow: "Your records",
    title: "Health vault",
    lede: "Upload reports and scans. Downloads use a short-lived link.",
    quote: {
      text: "An ounce of prevention is worth a pound of cure.",
      author: "Benjamin Franklin",
    },
    image: assets.hero.vault,
  },
  profile: {
    eyebrow: "Your account",
    title: "Profile",
    lede: "How this account appears on visits.",
    quote: {
      text: "Health is a state of complete harmony of the body, mind and spirit.",
      author: "B.K.S. Iyengar",
    },
    image: assets.hero.profile,
  },
  dashboard: {
    eyebrow: "Good day",
    title: "Doctor",
    lede: "",
    quote: {
      text: "Medicine is a science of uncertainty and an art of probability.",
      author: "William Osler",
    },
    image: assets.hero.dashboard,
  },
  calendar: {
    eyebrow: "Your schedule",
    title: "Calendar",
    lede: "Every booked consult for the week, at a glance.",
    quote: {
      text: "Time and health are two precious assets that we don’t recognize and appreciate until they have been depleted.",
      author: "Denis Waitley",
    },
    image: assets.hero.calendar,
  },
  queue: {
    eyebrow: "Today",
    title: "Patient queue",
    lede: "Confirmed consults, in order. Join, write notes and prescribe from here.",
    quote: {
      text: "Listen to your patient; he is telling you the diagnosis.",
      author: "William Osler",
    },
    image: assets.hero.queue,
  },
  availability: {
    eyebrow: "Your hours",
    title: "Working hours",
    lede: "Asia/Colombo. Slot length, buffer and daily cap save with the week. Leave dates are additive — they do not replace previous leave.",
    quote: {
      text: "Rest when you’re weary. Refresh and renew yourself, your body, your mind, your spirit.",
      author: "Ralph Marston",
    },
    image: assets.hero.availability,
  },
  earnings: {
    eyebrow: "Your practice",
    title: "Earnings",
    lede: "Settled consults from your practice ledger.",
    quote: {
      text: "It is health that is real wealth and not pieces of gold and silver.",
      author: "Mahatma Gandhi",
    },
    image: assets.hero.earnings,
  },
  doctorProfile: {
    eyebrow: "Your practice",
    title: "Profile",
    lede: "How patients see you in the directory.",
    quote: {
      text: "The best way to find yourself is to lose yourself in the service of others.",
      author: "Mahatma Gandhi",
    },
    image: assets.hero.doctorProfile,
  },
} satisfies Record<string, HeroCopy>;
