/** Permission to read the phone's tilt. iOS only grants it from inside a tap. */

type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

let granted = false;

function api() {
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window ? (window.DeviceOrientationEvent as unknown as PermissionApi) : null;
}

/** Call from the same tap that unlocks the sound. */
export function requestDeviceTilt() {
  const event = api();
  if (typeof event?.requestPermission !== "function") return;
  event
    .requestPermission()
    .then((answer) => {
      granted = answer === "granted";
    })
    .catch(() => {
      granted = false;
    });
}

/** Whether tilt events may arrive: on iOS once permitted, elsewhere wherever the API exists. */
export function deviceTiltAllowed() {
  const event = api();
  if (!event) return false;
  return typeof event.requestPermission === "function" ? granted : true;
}
