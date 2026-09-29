"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRefineStore, type RefineStep } from "@/lib/store/refineStore";
import { Stepper, STEP_INDEX } from "@/components/ai/refine/Stepper";
import { ConnectStep } from "@/components/ai/refine/ConnectStep";
import { SourcesStep } from "@/components/ai/refine/SourcesStep";
import { JobStep } from "@/components/ai/refine/JobStep";
import { RunStep } from "@/components/ai/refine/RunStep";

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 40 : -40, filter: "blur(6px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40, filter: "blur(6px)" }),
};

export function RefineFlow() {
  const step = useRefineStore((s) => s.step);
  const setStep = useRefineStore((s) => s.setStep);
  const reset = useRefineStore((s) => s.reset);
  const [dir, setDir] = useState(1);

  const go = (next: RefineStep) => {
    setDir(STEP_INDEX[next] >= STEP_INDEX[step] ? 1 : -1);
    setStep(next);
  };

  return (
    <div className="ws-view refine-flow">
      <div className="ws-head">
        <div>
          <h2>Refine to a job</h2>
          <p>Connect an assistant, bring your CVs, add the role — then compare tailored results. Only your own facts are used.</p>
        </div>
        <button className="ws-reset" onClick={reset} title="Start the flow over">Restart</button>
      </div>

      <Stepper step={step} onJump={go} />

      <div className="refine-stage">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="refine-step"
          >
            {step === "connect" && <ConnectStep onNext={() => go("sources")} />}
            {step === "sources" && <SourcesStep onBack={() => go("connect")} onNext={() => go("job")} />}
            {step === "job" && <JobStep onBack={() => go("sources")} onNext={() => go("run")} />}
            {step === "run" && <RunStep onBack={() => go("job")} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
