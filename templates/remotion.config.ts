import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setEntryPoint("src/index.ts");

// On machines where Remotion cannot download its own headless browser (e.g. CI containers),
// point it at an installed Chrome/Chromium. Unset on the owner's PC: Remotion uses its own.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
