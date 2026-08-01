"use client";

import Script from "next/script";
import { useEffect } from "react";

const ASSISTANT_TAG = "joi-live2d-assistant";

function mountAssistant() {
  if (document.querySelector(ASSISTANT_TAG)) return;
  if (!customElements.get(ASSISTANT_TAG)) return;
  const assistant = document.createElement(ASSISTANT_TAG);
  assistant.setAttribute("api-url", "/api/joi/");
  document.body.append(assistant);
}

export function Live2DRouteMount() {
  useEffect(() => {
    document.body.dataset.state = "home";
    mountAssistant();
    return () => {
      delete document.body.dataset.state;
      document.querySelector(ASSISTANT_TAG)?.remove();
    };
  }, []);

  return (
    <Script
      src="/live2d/joi-live2d.js"
      strategy="afterInteractive"
      onLoad={mountAssistant}
      onReady={mountAssistant}
    />
  );
}
