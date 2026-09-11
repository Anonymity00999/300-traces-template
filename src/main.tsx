import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import { TraceArchive } from "../app/trace-archive";
import { WatchRoom } from "../app/watch-room";
import { InstructionLibrary } from "../app/instruction-library";

const wantsWatchRoom = window.location.pathname === "/watch-room" || window.location.pathname.startsWith("/watch-room/");
const wantsInstructionLibrary = window.location.pathname === "/instruction-library" || window.location.pathname.startsWith("/instruction-library/");

const root = document.getElementById("root");

if (!root) throw new Error("The archive root element is missing.");

createRoot(root).render(
  <StrictMode>{wantsInstructionLibrary ? <InstructionLibrary /> : wantsWatchRoom ? <WatchRoom /> : <TraceArchive />}</StrictMode>,
);
