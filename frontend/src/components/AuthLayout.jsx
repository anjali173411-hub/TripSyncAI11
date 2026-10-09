import { Compass, Sparkles, Users, Wallet } from "lucide-react";

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="auth-page">
      <aside className="auth-hero">
        <div className="auth-brand">
          <span className="auth-logo">
            <Compass size={20} />
          </span>
          TripSync AI
        </div>

        <div className="auth-hero-text">
          <h2>Plan trips together, without the group-chat chaos.</h2>
          <ul>
            <li><Users size={17} /> Everyone adds what they love</li>
            <li><Sparkles size={17} /> AI builds one plan that fits the group</li>
            <li><Wallet size={17} /> Track the budget and split costs</li>
          </ul>
        </div>

        <svg className="auth-scene" viewBox="0 0 600 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <circle cx="500" cy="125" r="34" fill="#f6d27a" opacity="0.9" />
          <g className="auth-flight">
          <path d="M40 175 C 150 95, 270 85, 390 120" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" opacity="0.75" />
          <g transform="translate(390 120) rotate(18)" fill="#ffffff">
            <path d="M-14 -3 L10 -3 L16 0 L10 3 L-14 3 Z" />
            <path d="M-2 -3 L-8 -14 L-3 -14 L6 -3 Z" />
            <path d="M-2 3 L-8 14 L-3 14 L6 3 Z" />
            <path d="M-14 -3 L-18 -9 L-15 -9 L-9 -3 Z" />
          </g>
          </g>
          <path d="M0 200 L110 120 L190 175 L290 95 L400 180 L480 135 L600 195 L600 260 L0 260 Z" fill="#0f4a30" opacity="0.55" />
          <path d="M0 225 C 120 185, 230 240, 340 205 S 520 190, 600 215 L600 260 L0 260 Z" fill="#0b3a26" opacity="0.85" />
        </svg>
      </aside>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <Compass size={18} /> TripSync AI
          </div>
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
