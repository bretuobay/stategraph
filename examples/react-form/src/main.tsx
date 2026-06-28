import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { assign, fromPromise, setup } from "@stategraph/core";
import { useActor, useSelector } from "@stategraph/react";

interface FormCtx {
  value: string;
  error: string | null;
}

type FormEvent =
  | { type: "CHANGE"; value: string }
  | { type: "SUBMIT" }
  | { type: "RETRY" };

const formMachine = setup({
  guards: {
    isValid: ({ context }: { context: FormCtx }) => context.value.trim().length > 0,
  },
  actions: {
    setValue: assign<FormCtx, FormEvent>(({ event }) => {
      if (event.type !== "CHANGE") return {};
      return { value: event.value };
    }),
    clearError: assign<FormCtx>(() => ({ error: null })),
  },
  effects: {
    submitForm: fromPromise<{ value: string }, { ok: boolean }>(({ input }) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (input.value === "fail") {
            reject(new Error("Submission failed"));
          } else {
            resolve({ ok: true });
          }
        }, 1000);
      }),
    ),
  },
}).createMachine({
  id: "form",
  initial: "idle",
  context: { value: "", error: null },
  states: {
    idle: {
      on: {
        CHANGE: { actions: ["setValue"] },
        SUBMIT: { target: "submitting", guard: "isValid", actions: ["clearError"] },
      },
    },
    submitting: {
      invoke: {
        src: "submitForm",
        input: (args) => ({ value: (args.context as FormCtx).value }),
        onDone: "success",
        onError: "error",
      },
    },
    success: { type: "final" },
    error: {
      on: { RETRY: { target: "idle" } },
    },
  },
});

function FormApp(): React.JSX.Element {
  const { snapshot, send, actor } = useActor(formMachine);
  const inputValue = useSelector(actor, (s) => (s.context as FormCtx).value);

  const stateVal = typeof snapshot.value === "string" ? snapshot.value : "submitting";
  const isIdle = stateVal === "idle";
  const isSubmitting = stateVal === "submitting";
  const isSuccess = stateVal === "success";
  const isError = stateVal === "error";

  return createElement(
    "div",
    { style: { fontFamily: "sans-serif", padding: "2rem", maxWidth: "400px" } },
    createElement("h1", null, "Form example"),
    isSuccess
      ? createElement("p", { style: { color: "green" } }, "Submitted successfully!")
      : createElement(
          "div",
          null,
          createElement("label", null, "Value (type 'fail' to simulate error):"),
          createElement("br", null),
          createElement("input", {
            type: "text",
            value: inputValue,
            disabled: !isIdle,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              send({ type: "CHANGE", value: e.target.value });
            },
            style: { marginTop: "0.5rem", padding: "0.4rem", width: "100%" },
          }),
          isError
            ? createElement("p", { style: { color: "red" } }, "Error: submission failed.")
            : null,
          (isIdle || isError) &&
            createElement(
              "button",
              {
                onClick: () => {
                  send(isError ? { type: "RETRY" } : { type: "SUBMIT" });
                },
                style: { marginTop: "1rem", padding: "0.5rem 1rem" },
              },
              isError ? "Retry" : "Submit",
            ),
          isSubmitting ? createElement("p", null, "Submitting…") : null,
          createElement("p", null, "State: ", createElement("code", null, stateVal)),
        ),
  );
}

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");
createRoot(root).render(createElement(FormApp));
