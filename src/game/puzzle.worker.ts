import { WORDS } from "../../words.js";
import { generatePuzzle } from "./generator.ts";

// Erzeugung dauert einige hundert Millisekunden – im Worker bleibt die Oberfläche bedienbar
self.onmessage = (event: MessageEvent<string>) => {
    self.postMessage(generatePuzzle(event.data, WORDS));
};
