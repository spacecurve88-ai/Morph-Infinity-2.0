/// <reference lib="webworker" />
import { applyPlan, previewPlanDetails, planSchema } from "./engine";
import { validateDocument } from "./validation";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (event) => {
  try {
    const document = validateDocument(event.data.document),
      plan = planSchema.parse(event.data.plan);
    const result =
      event.data.mode === "apply"
        ? applyPlan(document, plan)
        : previewPlanDetails(document, plan);
    scope.postMessage({ ok: true, result });
  } catch (error) {
    scope.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Preview failed.",
    });
  }
};
