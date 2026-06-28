import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { setup } from "@stategraph/core";
import { useActor } from "@stategraph/react";

type ModalEvent = { type: "OPEN" } | { type: "CLOSE" };

const modalMachine = setup<object, ModalEvent>({}).createMachine({
  id: "modal",
  initial: "closed",
  context: {},
  states: {
    closed: { on: { OPEN: { target: "open" } } },
    open: { on: { CLOSE: { target: "closed" } } },
  },
});

function ModalApp(): React.JSX.Element {
  const { snapshot, send } = useActor(modalMachine);
  const stateLabel = typeof snapshot.value === "string" ? snapshot.value : "";
  const isOpen = stateLabel === "open";

  return createElement(
    "div",
    { style: { fontFamily: "sans-serif", padding: "2rem" } },
    createElement("h1", null, "Modal example"),
    createElement(
      "button",
      {
        onClick: () => { send({ type: "OPEN" }); },
        disabled: isOpen,
      },
      "Open modal",
    ),
    isOpen
      ? createElement(
          "dialog",
          { open: true, style: { padding: "2rem", border: "1px solid #ccc", borderRadius: "8px" } },
          createElement("h2", null, "Modal"),
          createElement("p", null, "State: ", createElement("code", null, stateLabel)),
          createElement(
            "button",
            { onClick: () => { send({ type: "CLOSE" }); } },
            "Close",
          ),
        )
      : null,
    createElement("p", null, "Current state: ", createElement("code", null, stateLabel)),
  );
}

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");
createRoot(root).render(createElement(ModalApp));
