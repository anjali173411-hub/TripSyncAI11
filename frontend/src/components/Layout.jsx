import Header from "./Header";

export default function Layout({ children, step }) {
  return (
    <>
      <Header />
      <main>
        <div className="wrap">
          {step && (
            <div className="steps">
              {["Trip details", "Preferences", "Itinerary"].map((x, i) => (
                <span
                  className={step === i + 1 ? "active" : ""}
                  key={x}
                >
                  {i + 1} {x}
                </span>
              ))}
            </div>
          )}
          {children}
        </div>
      </main>
    </>
  );
}
