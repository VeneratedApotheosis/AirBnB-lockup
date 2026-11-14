import { mountPopup } from "./popup";
import { mountPopupHeight } from "./popup-height";
import { sendRequest } from "./transport";

const width = document.querySelector<HTMLSelectElement>("#popup-width");
if (width) {
  const storageKey = "popup-width";
  const savedWidth = localStorage.getItem(storageKey);
  if (savedWidth && [...width.options].some((option) => option.value === savedWidth)) {
    width.value = savedWidth;
  }
  document.body.dataset.popupWidth = width.value;
  width.addEventListener("change", () => {
    document.body.dataset.popupWidth = width.value;
    localStorage.setItem(storageKey, width.value);
  });
}

mountPopupHeight(document, localStorage);
mountPopup(document, sendRequest);
