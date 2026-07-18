import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initializeTheme } from "./hooks/use-theme.ts";
import "./index.css";

// Initialize theme before rendering
initializeTheme();

createRoot(document.getElementById("root")!).render(<App />);
