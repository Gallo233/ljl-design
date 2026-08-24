"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createRoomScene } from "./room3d";
import { ROOM_OBJECTS, type RoomObjectId } from "./roomObjects";
import styles from "./joi-signal-lab.module.css";

/**
 * The room, mounted interactive beside the About copy.
 *
 * Own small WebGL context for now — the single-renderer merge later absorbs this
 * instance, which is why the scene module never owns a renderer. The loop only runs
 * while `active` (the About section is on screen); hover raycasts drive an object
 * lift plus a DOM tooltip, and clicks report the picked object so the panel can
 * light the matching interest chip.
 */
export function AboutRoom({
  active,
  onPick,
}: {
  active: boolean;
  onPick: (id: RoomObjectId | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const host = hostRef.current;
    const tooltip = tooltipRef.current;
    if (!host || !tooltip) return;

    let renderer: any;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // No WebGL: the About copy stands on its own.
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const room = createRoomScene();
    // The interactive view keeps the scene's night backdrop transparent so the layer
    // sits on the stage's own blue field instead of a hard rectangle.
    room.scene.background = null;

    const pointer = { x: 0, y: 0 };
    let hovered: RoomObjectId | null = null;
    let focused: RoomObjectId | null = null;

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setSize(width, height, false);
      room.setFullAspect(width / height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let frame = 0;
    const tick = (time: number) => {
      frame = window.requestAnimationFrame(tick);
      if (!activeRef.current) return;
      room.update(time, pointer);
      renderer.render(room.scene, room.fullCamera);
    };
    frame = window.requestAnimationFrame(tick);

    const ndcFrom = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      return {
        x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        y: -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      const id = room.raycastAt(ndcFrom(event));
      if (id !== hovered) {
        hovered = id;
        room.setHover(id);
        host.style.cursor = id ? "pointer" : "default";
        if (id) {
          const definition = ROOM_OBJECTS.find((entry) => entry.id === id);
          tooltip.textContent = definition ? `${definition.labelZh} / ${definition.label}` : "";
        }
        tooltip.style.opacity = id ? "1" : "0";
      }
      tooltip.style.transform = `translate(${event.clientX - bounds.left + 14}px, ${event.clientY - bounds.top - 26}px)`;
    };

    const onPointerLeave = () => {
      hovered = null;
      room.setHover(null);
      tooltip.style.opacity = "0";
      host.style.cursor = "default";
      pointer.x = 0;
      pointer.y = 0;
    };

    const onClick = (event: MouseEvent) => {
      const id = room.raycastAt(ndcFrom(event as unknown as PointerEvent));
      focused = id === focused ? null : id;
      room.focus(focused);
      onPickRef.current(focused);
    };

    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);
    host.addEventListener("click", onClick);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("click", onClick);
      room.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={hostRef} className={styles.aboutRoom} aria-label="我的房间 — 点击桌上的物件">
      <span ref={tooltipRef} className={styles.roomTooltip} aria-hidden="true" />
    </div>
  );
}
