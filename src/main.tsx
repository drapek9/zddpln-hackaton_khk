import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Toaster from "./components/Toaster";
import { ThemeProvider } from "./lib/theme";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
);
