"use client";

import Link from "next/link";
import { useUser } from "@/components/userContext";
import { IconArrowRight, IconBriefcase, IconInbox, IconMail, IconSparkles, IconUserPlus, IconUsers } from "@/components/icons";

const TOOLS = [
  {
    href: "/onboarding-queue",
    title: "Onboarding Queue",
    body: "Review new member sign-ups, assign their ID, and approve to send the welcome email and certificate.",
    Icon: IconInbox,
    tint: "from-brand-red to-brand-rose",
  },
  {
    href: "/member-onboarding",
    title: "Member Onboarding",
    body: "Send a welcome email to a member by hand, with their membership ID and a generated certificate.",
    Icon: IconMail,
    tint: "from-orange-500 to-amber-400",
  },
  {
    href: "/listings",
    title: "Job Listings",
    body: "Post volunteer positions to the Join Our Team page and review who applied.",
    Icon: IconBriefcase,
    tint: "from-fuchsia-600 to-pink-500",
  },
  {
    href: "/volunteer-onboarding",
    title: "Volunteer Onboarding",
    body: "Create a volunteer's @polishyouth.org account, set their signature, and send their welcome emails.",
    Icon: IconUserPlus,
    tint: "from-violet-600 to-fuchsia-500",
  },
  {
    href: "/org",
    title: "Org Chart",
    body: "Who does what and who reports to whom, straight from Google Workspace. Find anyone's role and email.",
    Icon: IconUsers,
    tint: "from-emerald-500 to-teal-400",
  },
  {
    href: "/chat",
    title: "PSM Assistant",
    body: "Ask anything about PSM operations, onboarding, events, or volunteers. Answers with live web search.",
    Icon: IconSparkles,
    tint: "from-sky-500 to-cyan-400",
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameFromEmail(email: string | null) {
  const local = (email ?? "").split("@")[0].split(".")[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
}

export default function Home() {
  const { userEmail } = useUser();
  const name = firstNameFromEmail(userEmail);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      {/* Hero */}
      <section className="mb-10 sm:mb-12 animate-fade-up">
        <p className="eyebrow mb-3">PSM Portal</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-brand-ink leading-[1.08]">
          {greeting()}
          {name && (
            <>
              , <span className="gradient-text">{name}</span>
            </>
          )}
          .
        </h1>
        <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-2xl">
          Internal tools for the Polish Youth Association. Pick up where the team left off.
        </p>
      </section>

      {/* Tool cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {TOOLS.map(({ href, title, body, Icon, tint }, i) => (
          <Link
            key={href}
            href={href}
            style={{ animationDelay: `${80 + i * 70}ms` }}
            className={`group relative card p-6 overflow-hidden animate-fade-up transition-all duration-300 hover:-translate-y-1 hover:shadow-lift hover:border-brand-red/20 ${i === TOOLS.length - 1 && TOOLS.length % 2 ? "sm:col-span-2" : ""}`}
          >
            {/* Hover glow */}
            <div
              className={`pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br ${tint} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20`}
            />
            <div className="relative flex items-start justify-between mb-5">
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tint} text-white flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <IconArrowRight className="w-5 h-5 text-gray-300 transition-all duration-300 group-hover:text-brand-red group-hover:translate-x-1" />
            </div>
            <h2 className="relative text-lg font-bold text-brand-ink mb-1.5">{title}</h2>
            <p className="relative text-sm text-gray-600 leading-relaxed">{body}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
