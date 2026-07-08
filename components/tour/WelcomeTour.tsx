"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";

const STEP_TITLES = ["Santa Barbara, daily.", "Tap the heart.", "Then mark what you did."];
const LAST_STEP = STEP_TITLES.length - 1;

function FeedCardIllustration() {
  return (
    <svg
      viewBox="0 0 300 172"
      width="100%"
      role="img"
      aria-label="A feed card, annotated. The title shows what is happening and where. The meta shows when it is scheduled. The description is a local's take on what is happening."
    >
      <defs>
        <linearGradient id="sbdTourArtsG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a4e7c" />
          <stop offset=".65" stopColor="#9C6B9E" />
          <stop offset="1" stopColor="#c79ac2" />
        </linearGradient>
      </defs>

      {/* section label */}
      <text x="14" y="16" fontFamily="'JetBrains Mono',monospace" fontSize="8" letterSpacing="1.5" fill="var(--ink-2)">
        HAPPENING TODAY
      </text>

      {/* card */}
      <rect x="15" y="33" width="270" height="100" rx="18" fill="var(--ink)" opacity="0.06" />
      <rect x="14" y="30" width="272" height="100" rx="18" fill="var(--surface)" stroke="var(--line)" strokeWidth="1" />
      {/* image (left, rounded on the left to match card) */}
      <path d="M32,30 H92 V130 H32 A18,18 0 0 1 14,112 V48 A18,18 0 0 1 32,30 Z" fill="url(#sbdTourArtsG)" />
      <rect x="28" y="66" width="14" height="28" rx="2" fill="#fff" opacity="0.20" stroke="#fff" strokeOpacity="0.28" />
      <rect x="50" y="72" width="14" height="28" rx="2" fill="#fff" opacity="0.14" stroke="#fff" strokeOpacity="0.22" />
      {/* vibe pill on the image (ARTS) */}
      <rect x="22" y="38" width="44" height="15" rx="7.5" fill="#7A4E7C" />
      <text
        x="44"
        y="48.4"
        textAnchor="middle"
        fontFamily="'JetBrains Mono',monospace"
        fontSize="6.6"
        fontWeight="700"
        letterSpacing="1"
        fill="var(--surface)"
      >
        ARTS
      </text>

      {/* title (what is happening) */}
      <text x="104" y="54" fontFamily="'Fraunces',serif" fontSize="13.5" fontWeight="700" fill="var(--ink)">
        First Thursday
      </text>
      <text x="104" y="69" fontFamily="'Fraunces',serif" fontSize="13.5" fontWeight="700" fill="var(--ink)">
        Art Walk
      </text>
      {/* description (local's take) */}
      <text x="104" y="85" fontFamily="'Inter',sans-serif" fontSize="8" fill="var(--ink-2)">
        Galleries stay open late and pour free
      </text>
      <text x="104" y="95" fontFamily="'Inter',sans-serif" fontSize="8" fill="var(--ink-2)">
        wine. The art is technically the point.
      </text>
      {/* meta (when + where) */}
      <text
        x="104"
        y="118"
        fontFamily="'JetBrains Mono',monospace"
        fontSize="7.5"
        fontWeight="600"
        letterSpacing="0.6"
        fill="var(--terra-text)"
      >
        TONIGHT · 5 PM · FUNK ZONE
      </text>
      {/* heart + share icons */}
      <path
        d="M251,120 C247,116.5 244,114.5 244,111.5 C244,109 246,108 248,109 C249.4,109.7 251,111.6 251,111.6 C251,111.6 252.6,109.7 254,109 C256,108 258,109 258,111.5 C258,114.5 255,116.5 251,120 Z"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M268,120 L277,111" fill="none" stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M277,111 l-6,0 M277,111 l0,6" fill="none" stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="round" />

      {/* ARROW 1 -> title */}
      <text x="170" y="19" fontFamily="'JetBrains Mono',monospace" fontSize="10" fontWeight="700" fill="var(--ink)">
        {"what's happening"}
      </text>
      <path
        d="M185.6,25.1 L184.2,25.6 L182.8,26.2 L181.3,26.3 L179.8,26.6 L178.5,27.4 L177.1,27.6 L175.6,27.9 L174.4,28.6 L173.1,29.1 L171.6,29.3 L170.4,30.0 L169.2,30.7 L167.8,31.0 L166.6,31.5 L165.5,32.4 L164.3,32.9 L163.0,33.3 L162.0,34.2 L160.9,34.9 L159.7,35.2 L158.7,36.1 L157.8,36.9 L156.6,37.3 L155.6,38.0 L154.8,38.9 L153.7,39.3 L152.3,36.1 L147.1,43.0 L155.7,43.9 L154.3,40.6 L155.5,40.5 L156.5,40.0 L157.7,39.6 L159.0,39.6 L160.1,39.1 L161.2,38.6 L162.5,38.5 L163.8,38.1 L164.9,37.4 L166.2,37.1 L167.5,36.9 L168.6,36.1 L169.8,35.6 L171.2,35.3 L172.4,34.5 L173.6,33.8 L174.9,33.4 L176.2,32.7 L177.3,31.8 L178.7,31.3 L180.0,30.7 L181.1,29.7 L182.4,29.0 L183.8,28.5 L185.0,27.5 L186.2,26.6 Z"
        fill="var(--ink)"
        stroke="var(--ink)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />

      {/* ARROW 2 -> meta (when) — tip lands under TONIGHT */}
      <text x="14" y="162" fontFamily="'JetBrains Mono',monospace" fontSize="10" fontWeight="700" fill="var(--ink)">
        {"when it's happening"}
      </text>
      <path
        d="M86.3,150.9 L87.8,150.5 L89.2,149.9 L90.8,149.7 L92.3,149.3 L93.6,148.4 L95.1,147.9 L96.7,147.4 L97.9,146.3 L99.3,145.5 L100.8,144.9 L102.0,143.8 L103.1,142.7 L104.4,141.9 L105.6,140.8 L106.4,139.5 L107.5,138.5 L108.5,137.5 L109.1,136.2 L109.8,135.0 L110.8,134.0 L111.2,132.7 L111.5,131.5 L112.2,130.5 L112.4,129.3 L112.4,128.1 L112.7,127.2 L115.9,128.0 L113.6,120.4 L108.1,126.0 L111.4,126.8 L110.7,127.6 L110.5,128.5 L109.9,129.4 L109.0,130.1 L108.4,131.0 L107.9,132.0 L106.8,132.7 L105.9,133.6 L105.3,134.7 L104.2,135.5 L103.1,136.2 L102.3,137.4 L101.2,138.3 L99.9,139.0 L99.0,140.1 L98.0,141.1 L96.7,141.8 L95.5,142.7 L94.5,143.9 L93.2,144.5 L91.9,145.3 L90.9,146.4 L89.6,147.1 L88.2,147.6 L87.0,148.6 L85.8,149.4 Z"
        fill="var(--ink)"
        stroke="var(--ink)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />

      {/* ARROW 3 -> description */}
      <text x="160" y="162" fontFamily="'JetBrains Mono',monospace" fontSize="10" fontWeight="700" fill="var(--ink)">
        {"a local's description"}
      </text>
      <path
        d="M191.0,150.1 L191.3,147.6 L191.4,145.0 L191.8,142.5 L191.9,140.0 L191.4,137.5 L191.2,135.1 L191.0,132.6 L190.1,130.3 L189.4,128.0 L188.8,125.6 L187.8,123.5 L186.5,121.5 L185.7,119.3 L184.5,117.3 L183.0,115.5 L181.9,113.6 L180.7,111.7 L179.1,110.2 L177.7,108.6 L176.6,106.9 L175.0,105.6 L173.5,104.4 L172.4,102.9 L171.1,101.7 L169.6,100.7 L168.5,99.5 L171.2,97.1 L163.0,94.4 L164.8,102.9 L167.5,100.4 L168.3,101.9 L169.5,103.1 L170.5,104.5 L171.3,106.2 L172.5,107.7 L173.8,109.1 L174.7,111.0 L175.8,112.7 L177.2,114.2 L178.1,116.1 L179.1,118.0 L180.5,119.7 L181.5,121.6 L182.2,123.7 L183.4,125.5 L184.5,127.5 L185.1,129.6 L186.0,131.6 L187.0,133.7 L187.4,135.9 L187.9,138.1 L188.7,140.3 L189.0,142.6 L188.9,145.0 L189.3,147.4 L189.4,149.9 Z"
        fill="var(--ink)"
        stroke="var(--ink)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WelcomeTour({
  open,
  step,
  setStep,
  onDismiss,
  onCta,
}: {
  open: boolean;
  step: number;
  setStep: (step: number) => void;
  onDismiss: () => void;
  onCta: () => void;
}) {
  const isLast = step === LAST_STEP;

  return (
    <BottomSheet open={open} onClose={onDismiss} ariaLabel="Welcome to SB Daymaker">
      <div className="sbd-tour" role="group" aria-roledescription="carousel">
        <div className="sbd-tour__top">
          <div className="sbd-tour__dots">
            {STEP_TITLES.map((_, n) => (
              <button
                key={n}
                type="button"
                className={`sbd-tour__dot${n === step ? " is-active" : ""}`}
                aria-label={`Go to step ${n + 1} of 3`}
                aria-current={n === step ? "step" : undefined}
                onClick={() => setStep(n)}
              />
            ))}
          </div>
          <button type="button" className="sbd-tour__skip" aria-label="Skip the intro" onClick={onDismiss}>
            Skip
          </button>
        </div>

        <p className="sbd-tour__sr" aria-live="polite">
          {`Step ${step + 1} of 3: ${STEP_TITLES[step]}`}
        </p>

        <div className={`sbd-tour__panel${step === 0 ? " is-active" : ""}`}>
          <div className="sbd-tour__kick">Welcome</div>
          <h3 className="sbd-tour__title">Santa Barbara, daily.</h3>
          <p className="sbd-tour__body">
            {"Open it like you check the weather. Here's what one pick looks like:"}
          </p>
          <div className="sbd-tour__art-frame">
            <FeedCardIllustration />
          </div>
        </div>

        <div className={`sbd-tour__panel${step === 1 ? " is-active" : ""}`}>
          <div className="sbd-tour__art sbd-tour__art--save">
            <div className="sbd-tour__save-card">
              <div className="sbd-tour__save-img" aria-hidden="true" />
              <div className="sbd-tour__save-body">
                <div className="sbd-tour__save-title">Trombone Shorty</div>
                <div className="sbd-tour__save-meta">SB Bowl · 6:30 PM</div>
              </div>
              <div className="sbd-tour__heart" aria-hidden="true">
                ♥
              </div>
            </div>
          </div>
          <div className="sbd-tour__kick">Save</div>
          <h3 className="sbd-tour__title">Tap the heart.</h3>
          <p className="sbd-tour__body">
            See something good? Save it. It lives <b>right here on your device</b>. No account, no login, ever.
          </p>
        </div>

        <div className={`sbd-tour__panel${step === 2 ? " is-active" : ""}`}>
          <div className="sbd-tour__art sbd-tour__art--been">
            <div className="sbd-tour__flow">
              <span className="sbd-tour__chip">♥ Want</span>
              <span className="sbd-tour__flow-arrow" aria-hidden="true">→</span>
              <span className="sbd-tour__chip sbd-tour__chip--been">✓ Been</span>
            </div>
          </div>
          <div className="sbd-tour__kick">Remember</div>
          <h3 className="sbd-tour__title sbd-tour__title--remember">Then mark what you did.</h3>
          <p className="sbd-tour__body">
            Come back and check off the places you made it to. Over time, SB Daymaker{" "}
            <b>learns your Santa Barbara</b>.
          </p>
        </div>

        <div className="sbd-tour__foot">
          <button
            type="button"
            className="sbd-tour__back"
            style={{ visibility: step === 0 ? "hidden" : "visible" }}
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
          {isLast ? (
            <button type="button" className="sbd-btn sbd-btn--cta" onClick={onCta}>
              Show me today
            </button>
          ) : (
            <button type="button" className="sbd-btn sbd-btn--primary" onClick={() => setStep(step + 1)}>
              Next
            </button>
          )}
        </div>
        {isLast ? <p className="sbd-tour__note">You can replay this anytime from the footer.</p> : null}
      </div>
    </BottomSheet>
  );
}
