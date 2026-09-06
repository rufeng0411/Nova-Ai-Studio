import React from "react";
import { Box, Text, useStdout } from "ink";
import { pilotDeckDarkBlueTheme } from "./theme.js";

// "NOVA" rendered in the ANSI Shadow figlet font.
const ANSI_SHADOW_LOGO = [
  "███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ",
  "████╗  ██║██╔═══██╗██║   ██║██╔══██╗",
  "██╔██╗ ██║██║   ██║██║   ██║███████║",
  "██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║",
  "██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║",
  "╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝",
];

const ANSI_SHADOW_VISIBLE_COLS = 37;
// border (2) + paddingX (4) + marginX (2) on the WelcomeCard wrapper.
const ANSI_SHADOW_MIN_TERMINAL_COLS = ANSI_SHADOW_VISIBLE_COLS + 8;

const STANDARD_LOGO = [
  " _   _                ",
  "| \\ | | _____   ____ _ ",
  "|  \\| |/ _ \\ \\ / / _` |",
  "| |\\  | (_) \\ V / (_| |",
  "|_| \\_|\\___/ \\_/ \\__,_|",
];

export function PilotDeckLogo({ tagline }: { tagline?: string } = {}): React.ReactNode {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const useShadow = cols >= ANSI_SHADOW_MIN_TERMINAL_COLS;

  return (
    <Box flexDirection="column">
      {useShadow
        ? ANSI_SHADOW_LOGO.map((line, index) => (
            <Text key={index} color={pilotDeckDarkBlueTheme.brand} bold>
              {line}
            </Text>
          ))
        : STANDARD_LOGO.map((line, index) => (
            <Text key={index} color={pilotDeckDarkBlueTheme.brand} bold>
              {line}
            </Text>
          ))}
      <Box marginTop={useShadow ? 0 : 1}>
        <Text color={pilotDeckDarkBlueTheme.brandAccent} bold>
          Ai-Studio
        </Text>
      </Box>
      {tagline ? (
        <Box marginTop={1}>
          <Text color={pilotDeckDarkBlueTheme.brandAccent} bold>
            {"↗  "}
          </Text>
          <Text color={pilotDeckDarkBlueTheme.subtle}>{tagline}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export function CondensedLogo(): React.ReactNode {
  return (
    <Text>
      <Text color={pilotDeckDarkBlueTheme.brand} bold>
        Nova
      </Text>
      <Text color={pilotDeckDarkBlueTheme.brandAccent} bold>
        {" Ai-Studio"}
      </Text>
      <Text color={pilotDeckDarkBlueTheme.brandAccent}> ↗</Text>
    </Text>
  );
}
