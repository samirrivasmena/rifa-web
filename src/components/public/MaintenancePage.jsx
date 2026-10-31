export default function MaintenancePage() {
  return (
    <main className="maintenance-page">
      <section className="maintenance-card">
        <div className="maintenance-icon" aria-hidden="true">
          🔧
        </div>

        <div className="maintenance-badge">
          MODO MANTENIMIENTO
        </div>

        <h1>
          PÁGINA EN
          <span> MANTENIMIENTO</span>
        </h1>

        <p className="maintenance-description">
          Estamos realizando mejoras para ofrecerte
          una mejor experiencia.
          <br />
          <strong>Volveremos muy pronto.</strong>
        </p>

        <div
          className="maintenance-loader"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>

        <div className="maintenance-divider" />

        <p className="maintenance-brand">
          SORTEOS <strong>LSD</strong>
        </p>
      </section>

      <style>{`
        .maintenance-page {
          min-height: 100svh;
          width: 100%;
          box-sizing: border-box;

          display: flex;
          align-items: center;
          justify-content: center;

          padding:
            max(24px, env(safe-area-inset-top))
            20px
            max(24px, env(safe-area-inset-bottom));

          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(220, 38, 38, 0.08),
              transparent 38%
            ),
            #f7f7f8;

          color: #111111;
        }

        .maintenance-card {
          position: relative;
          overflow: hidden;

          width: 100%;
          max-width: 580px;

          padding: 52px 34px 38px;
          box-sizing: border-box;

          text-align: center;

          background: #ffffff;

          border: 1px solid #e5e7eb;
          border-top: 5px solid #dc2626;
          border-radius: 24px;

          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.1);
        }

        .maintenance-card::before {
          content: "";

          position: absolute;
          top: -80px;
          right: -80px;

          width: 180px;
          height: 180px;

          border-radius: 50%;

          background: rgba(220, 38, 38, 0.05);

          pointer-events: none;
        }

        .maintenance-icon {
          width: 76px;
          height: 76px;

          margin: 0 auto 22px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 22px;

          background: #111111;

          box-shadow:
            0 10px 28px rgba(0, 0, 0, 0.16);

          font-size: 36px;
          line-height: 1;
        }

        .maintenance-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;

          margin-bottom: 18px;
          padding: 8px 14px;

          border: 1px solid rgba(220, 38, 38, 0.2);
          border-radius: 999px;

          background: rgba(220, 38, 38, 0.08);
          color: #dc2626;

          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .maintenance-card h1 {
          max-width: 500px;

          margin: 0 auto;

          color: #111111;

          font-size: clamp(30px, 6vw, 44px);
          line-height: 1.08;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .maintenance-card h1 span {
          color: #dc2626;
        }

        .maintenance-description {
          max-width: 440px;

          margin: 20px auto 0;

          color: #626262;

          font-size: 16px;
          line-height: 1.7;
        }

        .maintenance-description strong {
          color: #111111;
          font-weight: 800;
        }

        .maintenance-loader {
          display: flex;
          align-items: center;
          justify-content: center;

          gap: 8px;

          margin-top: 28px;
        }

        .maintenance-loader span {
          width: 8px;
          height: 8px;

          border-radius: 50%;

          background: #dc2626;

          animation:
            maintenancePulse 1.4s ease-in-out infinite;
        }

        .maintenance-loader span:nth-child(2) {
          animation-delay: 0.15s;
        }

        .maintenance-loader span:nth-child(3) {
          animation-delay: 0.3s;
        }

        .maintenance-divider {
          width: 52px;
          height: 3px;

          margin: 30px auto 20px;

          border-radius: 999px;

          background: #111111;
        }

        .maintenance-brand {
          margin: 0;

          color: #111111;

          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        .maintenance-brand strong {
          color: #dc2626;
        }

        @keyframes maintenancePulse {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.8);
          }

          50% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @media (max-width: 600px) {
          .maintenance-page {
            padding-left: 16px;
            padding-right: 16px;
          }

          .maintenance-card {
            padding: 42px 22px 32px;

            border-radius: 20px;
          }

          .maintenance-icon {
            width: 68px;
            height: 68px;

            border-radius: 19px;

            font-size: 32px;
          }

          .maintenance-description {
            font-size: 15px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .maintenance-loader span {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}