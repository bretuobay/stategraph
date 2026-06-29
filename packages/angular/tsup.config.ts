import { createTsupConfig } from "../../tsup.base";

export default createTsupConfig([
  "@stategraph/core",
  "@angular/core",
  "@angular/core/rxjs-interop",
  "rxjs",
]);
