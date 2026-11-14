import { mountPopup } from "./popup";
import { mountPopupSize } from "./popup-size";
import { sendRequest } from "./transport";

// Width presets, drag-to-resize handles and saved sizes (src/ui/popup-size.ts).
mountPopupSize(document, localStorage);
mountPopup(document, sendRequest);
