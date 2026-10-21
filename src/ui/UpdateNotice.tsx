import { useEffect, useState } from "react";
/** An update never reloads an editing user without an explicit choice. */
export function UpdateNotice({ blocked }: { blocked: boolean }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let alive = true,
      reg: ServiceWorkerRegistration | undefined;
    const inspect = () => {
      if (alive && reg?.waiting && navigator.serviceWorker.controller)
        setRegistration(reg);
    };
    const found = () => {
      const worker = reg?.installing;
      worker?.addEventListener("statechange", inspect);
    };
    navigator.serviceWorker.ready
      .then((r) => {
        if (!alive) return;
        reg = r;
        inspect();
        r.addEventListener("updatefound", found);
      })
      .catch(() => {});
    return () => {
      alive = false;
      reg?.removeEventListener("updatefound", found);
    };
  }, []);
  if (!registration?.waiting) return null;
  return (
    <div className="warning" role="status">
      A new version is available. Saved records stay on this device.{" "}
      <button
        className="link-button"
        disabled={blocked}
        onClick={() => {
          if (
            !confirm(
              "Reload to use the new version? Saved records are retained. Unsaved form edits will be lost.",
            )
          )
            return;
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => location.reload(),
            { once: true },
          );
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        Reload new version
      </button>
      {blocked && <span> Finish or cancel the current edit first.</span>}
    </div>
  );
}
