"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./joi-mobile-iphone.module.css";
import {
  createIPhone17ProScene,
  type IPhoneScene,
} from "./createIPhone17ProScene";
import { JOI_MOBILE_APPETIZE_URL } from "./appetize";

type Props = {
  poster: string;
  active?: boolean;
};

export function JoiMobileIPhoneShowcase({ poster, active = false }: Props) {
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const screenParkRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<IPhoneScene | null>(null);
  const activeRef = useRef(active);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [motionSupported, setMotionSupported] = useState(false);
  const [motionOn, setMotionOn] = useState(false);

  const nativePlayUrl = useMemo(() => {
    return JOI_MOBILE_APPETIZE_URL;
  }, []);

  const openNativeDemo = useCallback(() => {
    const popup = window.open(nativePlayUrl, "_blank", "noopener,noreferrer");
    if (popup) popup.opener = null;
  }, [nativePlayUrl]);

  useEffect(() => {
    activeRef.current = active;
    sceneRef.current?.setInteractionEnabled(active);
    if (active) {
      sceneRef.current?.resetView();
    } else if (motionOn) {
      // Leaving the gallery hands the pose back; a phone that keeps answering the
      // accelerometer while it is a thumbnail in the corner is just noise.
      void sceneRef.current?.setDeviceOrientation(false);
      setMotionOn(false);
    }
  }, [active, motionOn]);

  /*
   * Only offered where it can work: a desktop browser has no orientation sensor, and
   * `DeviceOrientationEvent` existing is not the same as it firing. Checked once on
   * mount so the control never appears as a button that does nothing.
   */
  useEffect(() => {
    const supported = typeof window !== "undefined"
      && "DeviceOrientationEvent" in window
      && window.matchMedia("(pointer: coarse)").matches;
    setMotionSupported(supported);
  }, []);

  const toggleMotion = useCallback(async () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const next = !motionOn;
    const ok = await scene.setDeviceOrientation(next);
    setMotionOn(next && ok);
    if (next && !ok) setMotionSupported(false);
  }, [motionOn]);

  useEffect(() => {
    const host = sceneHostRef.current;
    const screen = screenRef.current;
    const park = screenParkRef.current;
    if (!host || !screen || !park) return;

    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2") && !probe.getContext("webgl")) {
      setSceneFailed(true);
      return;
    }

    const handBackScreen = () => {
      if (screen.parentElement !== park) park.appendChild(screen);
    };

    try {
      const scene = createIPhone17ProScene({
        container: host,
        screenElement: screen,
        onScreenTap: openNativeDemo,
        onLiveReady: () => undefined,
        onFatal: () => {
          sceneRef.current?.dispose();
          sceneRef.current = null;
          handBackScreen();
          setSceneFailed(true);
        },
      });
      scene.setInteractionEnabled(activeRef.current);
      sceneRef.current = scene;
    } catch {
      handBackScreen();
      setSceneFailed(true);
    }

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
      handBackScreen();
    };
  }, [openNativeDemo]);

  return (
    <figure className={`${styles.showcase} ${active ? styles.active : ""}`}>
      <div className={styles.sceneHost} ref={sceneHostRef} aria-hidden={sceneFailed ? "true" : undefined} />
      {/* The scene lifts this element into its own layer and hands it back on dispose, so
          it has to exist — but nothing is drawn in it. It used to hold a copy of the home
          screen that no one ever saw: the scene sets it to opacity 0 on construction, and
          a scene that fails renders the flat card below instead. */}
      <div className={styles.screenPark} ref={screenParkRef}>
        <div className={styles.liveScreen} ref={screenRef} />
      </div>

      <noscript>
        <a className={styles.noScriptPhone} href={nativePlayUrl} target="_blank" rel="noreferrer">
          <img src={poster} alt="Joi Mobile home screen" />
          <span>OPEN IOS BUILD ↗</span>
        </a>
      </noscript>

      {sceneFailed && (
        <button className={styles.flatPhone} type="button" onClick={openNativeDemo}>
          <img src={poster} alt="Joi Mobile home screen" />
          <span>OPEN IOS BUILD ↗</span>
        </button>
      )}

      <div className={styles.controls} aria-hidden={!active}>
        {motionSupported && (
          <button
            type="button"
            onClick={() => void toggleMotion()}
            tabIndex={active ? 0 : -1}
            aria-pressed={motionOn}
          >
            {motionOn ? "RELEASE DEVICE" : "TILT TO TURN"}
          </button>
        )}
        <button type="button" onClick={() => sceneRef.current?.resetView()} tabIndex={active ? 0 : -1}>
          RESET VIEW
        </button>
        <a href={nativePlayUrl} target="_blank" rel="noreferrer" tabIndex={active ? 0 : -1}>
          OPEN IOS BUILD ↗
        </a>
      </div>
      <p className={styles.hint} aria-hidden="true">
        {active ? "DRAG TO TURN · WHEEL TO ZOOM · TAP SCREEN TO OPEN" : "DEVICE PREVIEW"}
      </p>
    </figure>
  );
}
