import { mountPopup } from "./popup";
import { sendRequest } from "./transport";

mountPopup(document, sendRequest);
