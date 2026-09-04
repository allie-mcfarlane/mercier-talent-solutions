import { serveBridgedExistingPage } from "./_shared/runtime-bridge.js";

export function onRequestGet(context) {
  return serveBridgedExistingPage(context, "contact");
}
