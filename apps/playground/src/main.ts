import { STATEGRAPH_DOM_PACKAGE } from "@stategraph/dom";
import { STATEGRAPH_REACT_PACKAGE } from "@stategraph/react";

document.querySelector<HTMLDivElement>("#app")!.textContent =
  `StateGraph playground scaffold using ${STATEGRAPH_REACT_PACKAGE} and ${STATEGRAPH_DOM_PACKAGE}`;
