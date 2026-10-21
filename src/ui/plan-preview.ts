import { useEffect, useState } from "react";
import type { Document } from "../core/model";
import type { FeaturePlan, PlanPreview } from "../core/engine";
export function planTask<T>(
  document: Document,
  plan: FeaturePlan,
  mode: "preview" | "apply",
) {
  const worker = new Worker(
    new URL("../core/plan-worker.ts", import.meta.url),
    { type: "module" },
  );
  const promise = new Promise<T>((resolve, reject) => {
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.result as T);
      else reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("The preview worker failed. No data has been changed."));
    };
    worker.postMessage({ document, plan, mode });
  });
  return { promise, cancel: () => worker.terminate() };
}
export function usePlanPreview(
  document: Document | undefined,
  plan: FeaturePlan | undefined,
) {
  const [state, setState] = useState<{
    plan?: FeaturePlan;
    revision?: string;
    result?: PlanPreview;
    error?: string;
    running?: boolean;
  }>({});
  useEffect(() => {
    if (!document || !plan) {
      setState({});
      return;
    }
    let alive = true;
    setState({ plan, revision: document.revision, running: true });
    const task = planTask<PlanPreview>(document, plan, "preview");
    task.promise
      .then((result) => {
        if (alive) setState({ plan, revision: document.revision, result });
      })
      .catch((error) => {
        if (alive)
          setState({ plan, revision: document.revision, error: error.message });
      });
    return () => {
      alive = false;
      task.cancel();
    };
  }, [document, plan]);
  return state.plan === plan && state.revision === document?.revision
    ? state
    : { running: !!plan };
}
