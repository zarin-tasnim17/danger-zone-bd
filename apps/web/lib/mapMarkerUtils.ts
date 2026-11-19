import L from "leaflet";
import { IncidentSeverity } from "@repo/shared";
import { getCategorySvg, getCategoryVisual } from "./incidentCategoryVisuals";

export { getCategorySvg, getCategoryVisual };

export interface MarkerDimensionConfig {
  size: number;
  iconSize: number;
  borderWidth: number;
}

/**
 * Responsive sizing rules according to map zoom level:
 * - Zoom <= 11: Compact 22px beacon (avoids overlap in national/district views while skipping nothing)
 * - Zoom 12-14: Balanced 28px safety badge (optimal for city/ward level navigation)
 * - Zoom >= 15: Prominent 32px tactile badge (high-definition street level)
 */
export function getMarkerDimensions(zoom: number = 13): MarkerDimensionConfig {
  if (zoom <= 11) {
    return { size: 22, iconSize: 11, borderWidth: 1.5 };
  }
  if (zoom <= 14) {
    return { size: 28, iconSize: 14, borderWidth: 2 };
  }
  return { size: 32, iconSize: 16, borderWidth: 2.5 };
}

/**
 * Palette configuration for each incident severity.
 * Decoupled from incident category: severity dictates danger signaling (color, glow, halo),
 * while category dictates the vector icon inside the marker badge.
 */
export function getSeverityColors(severity: IncidentSeverity) {
  const norm = (severity || "").toUpperCase();

  switch (norm) {
    case "CRITICAL":
      return {
        bg: "#E11D48", // Rose-600
        border: "#FFFFFF",
        glow: "rgba(225, 29, 72, 0.45)",
        halo: "rgba(225, 29, 72, 0.55)",
      };
    case "HIGH":
      return {
        bg: "#DC2626", // Red-600
        border: "#FFFFFF",
        glow: "rgba(220, 38, 38, 0.45)",
        halo: "rgba(220, 38, 38, 0.55)",
      };
    case "MEDIUM":
      return {
        bg: "#EA580C", // Orange-600
        border: "#FFFFFF",
        glow: "rgba(234, 88, 12, 0.35)",
        halo: "rgba(234, 88, 12, 0.35)",
      };
    case "LOW":
    default:
      return {
        bg: "#D97706", // Amber-600
        border: "#FFFFFF",
        glow: "rgba(217, 119, 6, 0.3)",
        halo: "rgba(217, 119, 6, 0.3)",
      };
  }
}

/**
 * Creates a perfectly centered, responsive, category-specific Danger Marker icon.
 * Preserves category identity across zoom levels, map styles, and severities.
 */
export function createDangerMarkerIcon(
  category: string,
  severity: IncidentSeverity,
  zoom: number = 13
): L.DivIcon {
  const norm = (severity || "").toUpperCase();
  const isHigh = norm === "HIGH" || norm === "CRITICAL";
  const { size, iconSize, borderWidth } = getMarkerDimensions(zoom);
  const colors = getSeverityColors(severity);
  const svg = getCategorySvg(category, iconSize);

  return L.divIcon({
    className: "custom-danger-pin",
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${
          isHigh
            ? `<span class="tactical-halo-pulse" style="
                position: absolute;
                inset: -3px;
                border-radius: 50%;
                background: radial-gradient(circle, ${colors.halo} 0%, rgba(220, 38, 38, 0) 70%);
                pointer-events: none;
              "></span>`
            : ""
        }
        <div class="danger-pin-badge" style="
          position: relative;
          background-color: ${colors.bg};
          border: ${borderWidth}px solid ${colors.border};
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          box-shadow: 0 4px 12px ${colors.glow}, 0 2px 4px rgba(15, 23, 42, 0.22);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        ">
          ${svg}
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -Math.round(size / 2 + 4)],
  });
}

/**
 * Creates a crisp Safe Haven sanctuary pin (Police, Hospital, Pharmacy, Fire Station).
 */
export function createSafeZoneIcon(
  type: string,
  isSelected: boolean = false
): L.DivIcon {
  const normType = (type || "").trim().toUpperCase();
  const isPolice = normType === "POLICE_BOX" || normType === "POLICE_STATION";
  const isHospital = normType === "HOSPITAL";
  const isPharmacy = normType === "PHARMACY";
  const isFireStation = normType === "FIRE_STATION";

  let bgColor = "#4F46E5";
  let iconSvg = "";

  if (isPolice) {
    bgColor = "#4F46E5";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  } else if (isHospital) {
    bgColor = "#2563EB";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12"/><path d="M6 12h12"/></svg>`;
  } else if (isPharmacy) {
    bgColor = "#059669";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`;
  } else if (isFireStation) {
    bgColor = "#EA580C";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
  } else {
    bgColor = "#4F46E5";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  }

  const size = isSelected ? 38 : 32;

  return L.divIcon({
    className: "custom-safe-pin",
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          background-color: ${bgColor};
          border: 2.5px solid #FFFFFF;
          width: ${size}px;
          height: ${size}px;
          border-radius: ${isPolice ? "12px" : "10px"};
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          box-shadow: 0 4px 12px ${bgColor}55, 0 2px 4px rgba(15,23,42,0.18);
          cursor: pointer;
          transform: ${isSelected ? "scale(1.15)" : "scale(1)"};
          transition: transform 0.2s ease;
        ">
          ${iconSvg}
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -Math.round(size / 2 + 4)],
  });
}
