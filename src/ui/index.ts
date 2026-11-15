import { mountPopup } from "./popup";
import { mountPageHelp } from "./page-help";
import { mountPopupSize } from "./popup-size";
import { sendRequest } from "./transport";

// Width presets, drag-to-resize handles and saved sizes (src/ui/popup-size.ts).
mountPopupSize(document, localStorage);
mountPopup(document, sendRequest);
mountPageHelp(document, sendRequest);
