"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./joi-mobile-iphone.module.css";
import {
  createIPhone17ProScene,
  type IPhoneScene,
} from "./createIPhone17ProScene";

const APPETIZE_BUILD_ID = "b_crwzussfaihmp5aqsmfzxyxwde";

type Props = {
  poster: string;
  label: string;
  caption: string;
};

export function JoiMobileIPhoneShowcase({ poster, label, caption }: Props) {
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const screenParkRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<IPhoneScene | null>(null);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [debug, setDebug] = useState(false);

  const nativePlayUrl = useMemo(() => {
    const query = new URLSearchParams({
      device: "iphone14pro",
      osVersion: "26.0",
      orientation: "portrait",
    });
    return `https://appetize.io/app/${APPETIZE_BUILD_ID}?${query.toString()}`;
  }, []);

  const openNativeDemo = useCallback(() => {
    const popup = window.open(nativePlayUrl, "_blank", "noopener,noreferrer");
    if (popup) popup.opener = null;
  }, [nativePlayUrl]);

  useEffect(() => {
    setDebug(process.env.NODE_ENV !== "production" || new URLSearchParams(window.location.search).has("modelDebug"));
  }, []);

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
      sceneRef.current = createIPhone17ProScene({
        container: host,
        screenElement: screen,
        posterUrl: poster,
        onScreenTap: openNativeDemo,
        onLiveReady: () => undefined,
        onFatal: () => {
          sceneRef.current?.dispose();
          sceneRef.current = null;
          handBackScreen();
          setSceneFailed(true);
        },
      });
    } catch {
      handBackScreen();
      setSceneFailed(true);
    }

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
      handBackScreen();
    };
  }, [openNativeDemo, poster]);

  const toggleExploded = useCallback(() => {
    setExploded((value) => {
      sceneRef.current?.setExploded(!value);
      return !value;
    });
  }, []);

  return (
    <figure className={styles.showcase} aria-labelledby="joi-mobile-device-title">
      <header className={styles.header}>
        <div>
          <span>{label}</span>
          <h2 id="joi-mobile-device-title">THE LINK, INSIDE THE OBJECT.</h2>
        </div>
        <p>
          Rotate Apple&apos;s official iPhone 17 Pro product-viewer model. The screen is intentionally left untouched so the hardware and materials can be reviewed without a soft simulator capture.
        </p>
      </header>

      <div className={`${styles.stage} ${styles["mode-preview"]} ${sceneFailed ? styles.failed : ""}`}>
        <div className={styles.sceneHost} ref={sceneHostRef} aria-hidden={sceneFailed ? "true" : undefined} />

        <div className={styles.screenPark} ref={screenParkRef}>
          <div className={styles.liveScreen} ref={screenRef}>
            <img className={styles.parkedPoster} src={poster} alt="iPhone 17 Pro Home Screen" />
          </div>
        </div>

        {sceneFailed && (
          <button className={styles.flatPhone} type="button" onClick={openNativeDemo} aria-label="Open the Joi Mobile native demo">
            <img src={poster} alt="iPhone 17 Pro Home Screen" />
            <span>OPEN NATIVE DEMO ↗</span>
          </button>
        )}

        <div className={styles.status} aria-live="polite">
          <span className={styles.statusDot} />
          DRAG TO TURN / TAP TO OPEN NATIVE DEMO
        </div>

        <div className={styles.controls}>
          <button type="button" onClick={() => sceneRef.current?.resetView()}>RESET VIEW</button>
          <a className={styles.primary} href={nativePlayUrl} target="_blank" rel="noreferrer">OPEN JOI MOBILE ↗</a>
          {debug && <button type="button" onClick={toggleExploded}>{exploded ? "ASSEMBLE" : "EXPLODE"}</button>}
        </div>
      </div>

      <figcaption className={styles.caption}>
        <p>{caption}</p>
        <dl>
          <div><dt>MODEL</dt><dd>APPLE PRODUCT VIEWER</dd></div>
          <div><dt>BODY</dt><dd>150 × 71.9 × 8.75 MM</dd></div>
          <div><dt>FINISH</dt><dd>COSMIC ORANGE</dd></div>
          <div><dt>SCREEN</dt><dd>APPLE ORIGINAL / NO OVERLAY</dd></div>
          <div><dt>ACTION</dt><dd>EXTERNAL NATIVE LINK</dd></div>
        </dl>
        <small>
          The phone geometry, display surface and PBR maps come from Apple&apos;s product viewer. The transparent screen hit-area still opens the uploaded iOS Simulator build in a new tab.
        </small>
      </figcaption>
    </figure>
  );
}
