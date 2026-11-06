import L from "leaflet";
import { IncidentSeverity } from "@repo/shared";

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
 * Vector SVG generator for each incident category with optical vertical centering.
 */
export function getCategorySvg(category: string, size: number = 14): string {
  const norm = (category || "").toUpperCase();

  switch (norm) {
    case "SNATCHING":
    case "MUGGING":
      // Siren / Rapid Snatch alert
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12a5 5 0 0 1 10 0v4H7v-4Z"/><path d="M5 20h14"/><path d="M12 4v2"/><path d="m4.93 7.93 1.41 1.41"/><path d="m19.07 7.93-1.41 1.41"/></svg>`;

    case "THEFT":
      // Lock / Burglary icon
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

    case "ROBBERY":
    case "DACOITY":
      // Armed Robbery / Masked Dagger
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m14.5 9-5 5"/><path d="m9.5 9 5 5"/></svg>`;

    case "THEFT_ROBBERY":
    case "THEFT_DACOITY":
      // Combined Dual Robbery Hazard Shield
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><circle cx="12" cy="11" r="3"/><path d="M12 14v3"/></svg>`;

    case "ARMED_ASSAULT":
      // Crossed Weapons / Sharp Blade Attack
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 17.5 5 5"/><path d="m9.5 6.5-5-5"/><path d="m4.5 17.5 15-15"/><path d="m19.5 17.5-15-15"/><path d="m9.5 17.5-5 5"/><path d="m14.5 6.5 5-5"/></svg>`;

    case "SNATCHING_ARMED_ASSAULT":
      // High-Danger Tactical Assault Snatch Alert
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

    case "YOUTH_GANG_ACTIVITY":
    case "TEEN_GANG":
      // Juvenile Gang Group Silhouette
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

    case "TEEN_GANG_ARMED_ASSAULT":
      // Gang Armed Clash Alert
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 15l-4-4"/><path d="M19 15l4-4"/></svg>`;

    case "EXTORTION":
      // Alert octagon / stop extortion sign
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    case "DRUG_RELATED_CRIME":
    case "DRUG_ACTIVITY":
      // Medical / narcotic capsule pill
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`;

    case "UNLIT_ROAD":
      // Slanted unlit bulb
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

    case "ROAD_ACCIDENT":
    case "ACCIDENT":
    case "ROADBLOCK":
      // Vehicle Collision / Road Obstacle Alert
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    case "FIRE":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;

    default:
      // High-visibility equilateral alert triangle
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="transform: translateY(-0.5px);"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }
}

/**
 * Palette configuration for each incident severity.
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
  const normType = (type || "").toUpperCase();
  const isPolice = normType === "POLICE_STATION" || normType === "POLICE_BOX";
  const isHospital = normType === "HOSPITAL";
  const isPharmacy = normType === "PHARMACY";
  const isFireStation = normType === "FIRE_STATION";

  let bgColor = "#059669";
  let iconSvg = "";

  if (isPolice) {
    bgColor = "#2563EB";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  } else if (isHospital) {
    bgColor = "#059669";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12"/><path d="M6 12h12"/></svg>`;
  } else if (isPharmacy) {
    bgColor = "#0D9488";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`;
  } else if (isFireStation) {
    bgColor = "#EA580C";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
  } else {
    bgColor = "#059669";
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
