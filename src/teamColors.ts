// Primary / secondary / number-text color by theme.key.
// NRL doesn't expose palette in the data API, so we pin known teams here.
export interface TeamPalette {
  primary: string;
  secondary: string;
  numberColor: string;
}

export const TEAM_COLORS: Record<string, TeamPalette> = {
  "broncos": { primary: "#760136", secondary: "#FCC730", numberColor: "#FCC730" },
  "bulldogs": { primary: "#00539F", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
  "cowboys": { primary: "#002B5C", secondary: "#FFC72C", numberColor: "#FFC72C" },
  "dolphins": { primary: "#AA1F2E", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
  "dragons": { primary: "#E1261C", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
  "eels": { primary: "#006EB5", secondary: "#FFB81C", numberColor: "#FFB81C" },
  "knights": { primary: "#EE3524", secondary: "#002B5C", numberColor: "#FFFFFF" },
  "panthers": { primary: "#221F1F", secondary: "#00843D", numberColor: "#FFFFFF" },
  "rabbitohs": { primary: "#006847", secondary: "#E6112A", numberColor: "#FFFFFF" },
  "raiders": { primary: "#97D700", secondary: "#002B5C", numberColor: "#002B5C" },
  "roosters": { primary: "#002B5C", secondary: "#E6112A", numberColor: "#FFFFFF" },
  "sea-eagles": { primary: "#6F263D", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
  "sharks": { primary: "#00AEEF", secondary: "#231F20", numberColor: "#FFFFFF" },
  "storm": { primary: "#632390", secondary: "#FFB81C", numberColor: "#FFFFFF" },
  "titans": { primary: "#F2C12E", secondary: "#00BDF2", numberColor: "#00BDF2" },
  "warriors": { primary: "#000000", secondary: "#C8102E", numberColor: "#FFFFFF" },
  "wests-tigers": { primary: "#F68D2E", secondary: "#000000", numberColor: "#000000" },
};

export function palette(themeKey: string): TeamPalette {
  return TEAM_COLORS[themeKey] ?? { primary: "#333333", secondary: "#DDDDDD", numberColor: "#FFFFFF" };
}
