// The one connection to the Android helper (scripts/NexaDevicePlugin.java).
// Capacitor only allows a plugin to be registered once, so everything shares this.

import { registerPlugin } from '@capacitor/core';

export const NexaDevice = registerPlugin('NexaDevice');
