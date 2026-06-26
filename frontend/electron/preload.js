/**
 * Electron preload script.
 * Exposes IS_ELECTRON flag to the renderer so connectionConfig.js
 * can detect the Electron runtime.
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("IS_ELECTRON", true);
