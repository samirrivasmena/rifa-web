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
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);

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
      // localStorage puede estar bloqueado en algunos navegadores.
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
        // Chrome, Safari y otros navegadores pueden bloquear
        // audio automático hasta que el usuario interactúe.
        if (!cancelado) {
          setPlaying(false);
        }
      }
    };

    intentarReproducir();

    // Si el navegador bloqueó el autoplay, volvemos a intentar
    // después de la primera interacción real del visitante.
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

    window.addEventListener("pointerdown", iniciarTrasInteraccion, {
      once: true,
    });

    window.addEventListener("keydown", iniciarTrasInteraccion, {
      once: true,
    });

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
      console.error("No se pudo reproducir la música:", error);
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
      localStorage.setItem(MUTED_KEY, String(nuevoMuted));
    } catch {
      // Ignorar si localStorage no está disponible.
    }
  };

  // =========================================================
  // VOLUMEN
  // =========================================================

  const cambiarVolumen = (event) => {
    const nuevoVolumen = Number(event.target.value);

    setVolume(nuevoVolumen);

    try {
      localStorage.setItem(VOLUME_KEY, String(nuevoVolumen));
    } catch {
      // Ignorar si localStorage no está disponible.
    }

    if (nuevoVolumen > 0 && muted) {
      setMuted(false);

      try {
        localStorage.setItem(MUTED_KEY, "false");
      } catch {
        // Ignorar.
      }
    }
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
        <div className={`public-music-player ${expanded ? "is-expanded" : ""}`}>
          <button
            type="button"
            className="public-music-main-button"
            onClick={togglePlay}
            aria-label={playing ? "Pausar música" : "Reproducir música"}
            title={playing ? "Pausar música" : "Reproducir música"}
          >
            {playing ? "⏸" : "▶"}
          </button>

          <button
            type="button"
            className="public-music-info"
            onClick={() => setExpanded((value) => !value)}
            aria-label="Mostrar controles de música"
          >
            <span className="public-music-icon">🎵</span>

            <span className="public-music-text">
              <strong>
                {config?.musica_nombre || "Música"}
              </strong>

              <small>
                {playing ? "Reproduciendo" : "Pausada"}
              </small>
            </span>
          </button>

          <div className="public-music-controls">
            <button
              type="button"
              className="public-music-mute"
              onClick={toggleMute}
              aria-label={muted ? "Activar sonido" : "Silenciar"}
              title={muted ? "Activar sonido" : "Silenciar"}
            >
              {muted || volume === 0 ? "🔇" : "🔊"}
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
        </div>
      )}

      <style jsx>{`
        .public-music-player {
          position: fixed;
          top: 110px;
          right: 18px;
          z-index: 9990;

          display: flex;
          align-items: center;
          gap: 8px;

          width: auto;
          max-width: min(430px, calc(100vw - 28px));

          padding: 7px 9px;

          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;

          background: rgba(15, 15, 18, 0.9);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);

          color: #ffffff;

          box-shadow:
            0 10px 30px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .public-music-main-button,
        .public-music-mute {
          border: 0;
          outline: 0;
          cursor: pointer;

          display: grid;
          place-items: center;

          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);

          transition:
            transform 0.18s ease,
            background 0.18s ease;
        }

        .public-music-main-button:hover,
        .public-music-mute:hover {
          background: rgba(255, 255, 255, 0.17);
          transform: scale(1.04);
        }

        .public-music-main-button {
          width: 36px;
          height: 36px;
          flex: 0 0 36px;

          border-radius: 50%;

          font-size: 14px;
        }

        .public-music-info {
          min-width: 0;

          display: flex;
          align-items: center;
          gap: 7px;

          padding: 0;

          border: 0;
          background: transparent;
          color: inherit;

          text-align: left;
          cursor: pointer;
        }

        .public-music-icon {
          font-size: 17px;
          line-height: 1;
        }

        .public-music-text {
          min-width: 0;

          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .public-music-text strong {
          display: block;

          max-width: 125px;

          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;

          font-size: 12px;
          line-height: 1.2;
          font-weight: 700;
        }

        .public-music-text small {
          font-size: 9px;
          line-height: 1.2;
          color: rgba(255, 255, 255, 0.65);
        }

        .public-music-controls {
          display: flex;
          align-items: center;
          gap: 7px;

          padding-left: 8px;
          border-left: 1px solid rgba(255, 255, 255, 0.12);
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
          accent-color: var(--site-primary, #dc2626);
        }

        .public-music-percent {
          min-width: 30px;

          font-size: 9px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
        }

@media (max-width: 640px) {
  .public-music-player {
    top: 100px;
            right: 10px;

            max-width: calc(100vw - 20px);

            border-radius: 16px;
          }

          .public-music-controls {
            display: none;
          }

          .public-music-player.is-expanded
            .public-music-controls {
            display: flex;
          }

          .public-music-text strong {
            max-width: 100px;
          }

          .public-music-player:not(.is-expanded)
            .public-music-text small {
            display: none;
          }

          .public-music-volume {
            width: 65px;
          }
        }
      `}</style>
    </>
  );
}