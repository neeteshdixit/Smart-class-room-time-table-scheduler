import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { CursorProvider } from "./context/CursorContext";
import CustomCursor from "./components/CustomCursor";
import AuroraBackground from "./components/AuroraBackground";
import SmoothScroll from "./components/SmoothScroll";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CursorProvider>
          <SmoothScroll>
            <CustomCursor />
            <AuroraBackground>
              <App />
            </AuroraBackground>
          </SmoothScroll>
        </CursorProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
