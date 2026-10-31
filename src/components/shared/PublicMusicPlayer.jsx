"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const VOLUME_KEY = "sorteoslsd_music_volume";
const MUTED_KEY = "sorteoslsd_music_muted";

export default function PublicMusicPlayer() {
  const pathname = usePathname();
  const { config } = useSiteConfig();

  const audioRef = useRef(null);
  const userPausedRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [ready, setReady] = useState(false);

  // 0 = discreto
  // 1 = mini reproductor
  // 2 = reproductor completo
  const [panelState, setPanelState] = useState(0);

  // =========================================================
  // NO MOSTRAR EN ZONAS ADMINISTRATIVAS
  // =========================================================

  const esRutaAdmin =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/admin-login") ||
    pathname?.startsWith("/admin-mfa-setup");

  // =========================================================
  // CONFIGURACIÓN INICIAL DEL VISITANTE
  // =========================================================

  useEffect(() => {
    if (!config) return;

    let volumenInicial = Number(config.musica_volumen ?? 0.35);

    if (!Number.isFinite(volumenInicial)) {
      volumenInicial = 0.35;
    }

    volumenInicial = Math.max(0, Math.min(1, volumenInicial));

    try {
      const volumenGuardado = localStorage.getItem(VOLUME_KEY);
      const mutedGuardado = localStorage.getItem(MUTED_KEY);

      if (volumenGuardado !== null) {
        const numero = Number(volumenGuardado);

        if (Number.isFinite(numero)) {
          volumenInicial = Math.max(0, Math.min(1, numero));
        }
      }

      if (mutedGuardado !== null) {
        setMuted(mutedGuardado === "true");
      }
    } catch {
      // localStorage puede estar bloqueado.
    }

    setVolume(volumenInicial);
    setReady(true);
  }, [config]);

  // =========================================================
  // SINCRONIZAR AUDIO
  // =========================================================

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !ready) return;

    audio.volume = volume;
    audio.muted = muted;
    audio.loop = config?.musica_loop !== false;
  }, [volume, muted, ready, config?.musica_loop]);

  // =========================================================
  // AUTOPLAY INTELIGENTE
  // =========================================================

  useEffect(() => {
    const audio = audioRef.current;

    if (
      !audio ||
      !ready ||
      !config?.musica_activa ||
      !config?.musica_url ||
      !config?.musica_autoplay
    ) {
      return;
    }

    let cancelado = false;

    const intentarReproducir = async () => {
      if (userPausedRef.current || cancelado) return;

      try {
        await audio.play();

        if (!cancelado) {
          setPlaying(true);
        }
      } catch {
        // Algunos navegadores bloquean el autoplay con sonido.
        if (!cancelado) {
          setPlaying(false);
        }
      }
    };

    intentarReproducir();

    const iniciarTrasInteraccion = () => {
      if (
        !audio.paused ||
        userPausedRef.current ||
        !config?.musica_autoplay
      ) {
        return;
      }

      intentarReproducir();
    };

    window.addEventListener(
      "pointerdown",
      iniciarTrasInteraccion,
      { once: true }
    );

    window.addEventListener(
      "keydown",
      iniciarTrasInteraccion,
      { once: true }
    );

    return () => {
      cancelado = true;

      window.removeEventListener(
        "pointerdown",
        iniciarTrasInteraccion
      );

      window.removeEventListener(
        "keydown",
        iniciarTrasInteraccion
      );
    };
  }, [
    ready,
    config?.musica_activa,
    config?.musica_url,
    config?.musica_autoplay,
  ]);

  // =========================================================
  // PLAY / PAUSA
  // =========================================================

  const togglePlay = async () => {
    const audio = audioRef.current;

    if (!audio) return;

    if (!audio.paused) {
      userPausedRef.current = true;
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      userPausedRef.current = false;
      await audio.play();
      setPlaying(true);
    } catch (error) {
      console.error(
        "No se pudo reproducir la música:",
        error
      );

      setPlaying(false);
    }
  };

  // =========================================================
  // MUTE
  // =========================================================

  const toggleMute = () => {
    const nuevoMuted = !muted;

    setMuted(nuevoMuted);

    try {
      localStorage.setItem(
        MUTED_KEY,
        String(nuevoMuted)
      );
    } catch {
      // Ignorar si localStorage no está disponible.
    }
  };

  // =========================================================
  // VOLUMEN
  // =========================================================

  const cambiarVolumen = (event) => {
    const nuevoVolumen = Number(event.target.value);

    if (!Number.isFinite(nuevoVolumen)) return;

    const volumenSeguro = Math.max(
      0,
      Math.min(1, nuevoVolumen)
    );

    setVolume(volumenSeguro);

    try {
      localStorage.setItem(
        VOLUME_KEY,
        String(volumenSeguro)
      );
    } catch {
      // Ignorar.
    }

    if (volumenSeguro > 0 && muted) {
      setMuted(false);

      try {
        localStorage.setItem(MUTED_KEY, "false");
      } catch {
        // Ignorar.
      }
    }
  };

  // =========================================================
  // CAMBIAR ESTADO DEL PANEL
  //
  // 0 -> 1
  // 1 -> 2
  // 2 -> 0
  // =========================================================

  const cambiarEstadoPanel = () => {
    setPanelState((estadoActual) => {
      if (estadoActual === 0) return 1;
      if (estadoActual === 1) return 2;

      return 0;
    });
  };

  // =========================================================
  // NO RENDERIZAR
  // =========================================================

  if (
    esRutaAdmin ||
    !config?.musica_activa ||
    !config?.musica_url
  ) {
    return null;
  }

  const mostrarControles =
    config?.musica_mostrar_controles !== false;

  const nombreMusica =
    config?.musica_nombre?.trim() || "Música";

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <>
      <audio
        ref={audioRef}
        src={config.musica_url}
        preload="metadata"
        loop={config?.musica_loop !== false}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {mostrarControles && (
        <div
          className={`public-music-player state-${panelState}`}
        >
          {/* ===============================================
              PESTAÑA DISCRETA / BOTÓN DE EXPANSIÓN
          =============================================== */}

          <button
            type="button"
            className="public-music-tab"
            onClick={cambiarEstadoPanel}
            aria-label={
              panelState === 0
                ? "Abrir reproductor de música"
                : panelState === 1
                  ? "Mostrar controles de volumen"
                  : "Cerrar reproductor de música"
            }
            title={
              panelState === 0
                ? "Abrir música"
                : panelState === 1
                  ? "Más controles"
                  : "Cerrar"
            }
          >
            <span className="public-music-tab-note">
              🎵
            </span>

            <span className="public-music-tab-arrow">
              {panelState === 0
                ? "‹"
                : panelState === 1
                  ? "‹"
                  : "›"}
            </span>
          </button>

          {/* ===============================================
              CONTENIDO DEL REPRODUCTOR
          =============================================== */}

          {panelState > 0 && (
            <div className="public-music-body">
              <button
                type="button"
                className="public-music-main-button"
                onClick={togglePlay}
                aria-label={
                  playing
                    ? "Pausar música"
                    : "Reproducir música"
                }
                title={
                  playing
                    ? "Pausar música"
                    : "Reproducir música"
                }
              >
                {playing ? "⏸" : "▶"}
              </button>

              {/* ===========================================
                  TÍTULO ANIMADO
              =========================================== */}

              <button
                type="button"
                className="public-music-info"
                onClick={cambiarEstadoPanel}
                aria-label={
                  panelState === 1
                    ? "Mostrar controles completos"
                    : "Cerrar reproductor"
                }
              >
                <div className="public-music-title-window">
                  <div className="public-music-title-track">
                    <span>{nombreMusica}</span>

                    <span
                      className="public-music-title-separator"
                      aria-hidden="true"
                    >
                      •
                    </span>

                    <span aria-hidden="true">
                      {nombreMusica}
                    </span>

                    <span
                      className="public-music-title-separator"
                      aria-hidden="true"
                    >
                      •
                    </span>
                  </div>
                </div>

                <small className="public-music-status">
                  {playing
                    ? "Reproduciendo"
                    : "Pausada"}
                </small>
              </button>

              {/* ===========================================
                  CONTROLES COMPLETOS
              =========================================== */}

              {panelState === 2 && (
                <div className="public-music-controls">
                  <button
                    type="button"
                    className="public-music-mute"
                    onClick={toggleMute}
                    aria-label={
                      muted
                        ? "Activar sonido"
                        : "Silenciar"
                    }
                    title={
                      muted
                        ? "Activar sonido"
                        : "Silenciar"
                    }
                  >
                    {muted || volume === 0
                      ? "🔇"
                      : "🔊"}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={cambiarVolumen}
                    className="public-music-volume"
                    aria-label="Volumen de la música"
                  />

                  <span className="public-music-percent">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        /* =================================================
           CONTENEDOR GENERAL
        ================================================= */

        .public-music-player {
          position: fixed;

          top: 130px;
          right: 0;

          z-index: 9990;

          display: flex;
          align-items: center;

          color: #ffffff;

          transition:
            width 0.28s ease,
            transform 0.28s ease,
            opacity 0.28s ease;
        }

        /* =================================================
           PESTAÑA LATERAL
        ================================================= */

        .public-music-tab {
          position: relative;
          z-index: 2;

          width: 48px;
          height: 46px;

          flex: 0 0 48px;

          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;

          padding: 0;

          border: 1px solid
            rgba(255, 255, 255, 0.13);

          border-right: 0;

          border-radius: 18px 0 0 18px;

          background: rgba(15, 15, 18, 0.92);

          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);

          box-shadow:
            -5px 8px 24px rgba(0, 0, 0, 0.2),
            inset 0 1px 0
              rgba(255, 255, 255, 0.05);

          color: #ffffff;

          cursor: pointer;

          transition:
            width 0.2s ease,
            background 0.2s ease,
            transform 0.2s ease;
        }

        .public-music-tab:hover {
          background: rgba(25, 25, 29, 0.96);
        }

.public-music-tab-note {
  display: block;

  font-size: 20px;
  line-height: 1;
}
        .public-music-tab-arrow {
          display: block;

          margin-top: -1px;

          font-size: 26px;
          font-weight: 700;
          line-height: 1;

          color: rgba(255, 255, 255, 0.68);

          transition: transform 0.25s ease;
        }

        /* =================================================
           ESTADO CERRADO
        ================================================= */

.public-music-player.state-0
  .public-music-tab {
  width: 52px;
  height: 50px;
  flex-basis: 52px;

  opacity: 0.95;
}

        .public-music-player.state-0
          .public-music-tab:hover {
          width: 48px;
          opacity: 1;
        }

        /* =================================================
           CUERPO
        ================================================= */

        .public-music-body {
          display: flex;
          align-items: center;
          gap: 8px;

          min-width: 0;

          margin-right: 8px;
          margin-left: 5px;

          padding: 6px 8px;

          border: 1px solid
            rgba(255, 255, 255, 0.13);

          border-radius: 17px;

          background: rgba(15, 15, 18, 0.92);

          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);

          box-shadow:
            0 10px 30px rgba(0, 0, 0, 0.23),
            inset 0 1px 0
              rgba(255, 255, 255, 0.05);

          animation: musicPanelIn 0.24s ease both;
        }

        @keyframes musicPanelIn {
          from {
            opacity: 0;
            transform: translateX(12px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* =================================================
           PLAY / PAUSA
        ================================================= */

        .public-music-main-button,
        .public-music-mute {
          border: 0;
          outline: 0;

          display: grid;
          place-items: center;

          color: #ffffff;

          background: rgba(
            255,
            255,
            255,
            0.1
          );

          cursor: pointer;

          transition:
            transform 0.18s ease,
            background 0.18s ease;
        }

        .public-music-main-button:hover,
        .public-music-mute:hover {
          background: rgba(
            255,
            255,
            255,
            0.17
          );

          transform: scale(1.04);
        }

        .public-music-main-button {
          width: 36px;
          height: 36px;

          flex: 0 0 36px;

          border-radius: 50%;

          font-size: 13px;
        }

        /* =================================================
           INFORMACIÓN / TÍTULO
        ================================================= */

        .public-music-info {
          width: 130px;
          min-width: 0;

          display: flex;
          flex-direction: column;

          gap: 2px;

          padding: 0;

          overflow: hidden;

          border: 0;
          outline: 0;

          background: transparent;

          color: inherit;

          text-align: left;

          cursor: pointer;
        }

        /* =================================================
           VENTANA DEL TÍTULO
        ================================================= */

        .public-music-title-window {
          position: relative;

          width: 100%;

          overflow: hidden;

          white-space: nowrap;

          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0,
            black 8%,
            black 92%,
            transparent 100%
          );

          mask-image: linear-gradient(
            to right,
            transparent 0,
            black 8%,
            black 92%,
            transparent 100%
          );
        }

        .public-music-title-track {
          display: flex;
          align-items: center;

          width: max-content;

          gap: 14px;

          padding-right: 14px;

          font-size: 12px;
          line-height: 1.25;
          font-weight: 750;

          animation:
            musicTitleScroll 11s linear infinite;
        }

        .public-music-title-track span {
          display: inline-block;
          white-space: nowrap;
        }

        .public-music-title-separator {
          opacity: 0.45;
        }

        @keyframes musicTitleScroll {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-50%);
          }
        }

        .public-music-info:hover
          .public-music-title-track {
          animation-play-state: paused;
        }

        .public-music-status {
          display: block;

          padding-left: 2px;

          font-size: 9px;
          line-height: 1.2;

          color: rgba(
            255,
            255,
            255,
            0.62
          );
        }

        /* =================================================
           CONTROLES COMPLETOS
        ================================================= */

        .public-music-controls {
          display: flex;
          align-items: center;

          gap: 7px;

          padding-left: 8px;

          border-left: 1px solid
            rgba(255, 255, 255, 0.12);

          animation:
            musicControlsIn 0.2s ease both;
        }

        @keyframes musicControlsIn {
          from {
            opacity: 0;
            transform: translateX(6px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .public-music-mute {
          width: 30px;
          height: 30px;

          flex: 0 0 30px;

          border-radius: 10px;

          font-size: 14px;
        }

        .public-music-volume {
          width: 80px;

          cursor: pointer;

          accent-color: var(
            --site-primary,
            #dc2626
          );
        }

        .public-music-percent {
          min-width: 30px;

          font-size: 9px;
          font-weight: 700;

          color: rgba(
            255,
            255,
            255,
            0.7
          );
        }

        /* =================================================
           TELÉFONOS
        ================================================= */

        @media (max-width: 640px) {
          .public-music-player {
            top: 120px;
          }

          .public-music-tab {
            width: 42px;
            height: 42px;

            flex-basis: 42px;

            border-radius: 16px 0 0 16px;
          }

.public-music-player.state-0
  .public-music-tab {
  width: 46px;
  height: 46px;
  flex-basis: 46px;
}

.public-music-tab-note {
  font-size: 18px;
}

.public-music-tab-arrow {
  font-size: 23px;
  font-weight: 700;
}
          .public-music-body {
            gap: 6px;

            margin-left: 4px;
            margin-right: 6px;

            padding: 5px 6px;

            border-radius: 15px;

            max-width: calc(100vw - 52px);
          }

          .public-music-main-button {
            width: 34px;
            height: 34px;

            flex-basis: 34px;
          }

          .public-music-info {
            width: 105px;
          }

          .public-music-title-track {
            font-size: 11px;

            animation-duration: 10s;
          }

          .public-music-status {
            font-size: 8px;
          }

          .public-music-controls {
            gap: 5px;

            padding-left: 6px;
          }

          .public-music-mute {
            width: 28px;
            height: 28px;

            flex-basis: 28px;
          }

          .public-music-volume {
            width: 58px;
          }

          .public-music-percent {
            display: none;
          }
        }

        /* =================================================
           TELÉFONOS MUY PEQUEÑOS
        ================================================= */

        @media (max-width: 380px) {
          .public-music-info {
            width: 88px;
          }

          .public-music-volume {
            width: 48px;
          }
        }

        /* =================================================
           ACCESIBILIDAD - MENOS MOVIMIENTO
        ================================================= */

        @media (
          prefers-reduced-motion: reduce
        ) {
          .public-music-title-track {
            animation: none;
          }

          .public-music-body,
          .public-music-controls {
            animation: none;
          }

          .public-music-player,
          .public-music-tab {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}