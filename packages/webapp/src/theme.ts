import { createTheme, type MantineColorsTuple } from '@mantine/core';

const primary: MantineColorsTuple = [
  '#eef9ee',
  '#dceedb',
  '#b3ddb1',
  '#86cb83',
  '#62bb5d',
  '#4cb245',
  '#3fae37',
  '#319829',
  '#288722',
  '#1b7517',
];

export const theme = createTheme({
  primaryColor: 'primary',
  colors: { primary },
  fontFamily:
    '"Inter", "Hiragino Sans", "Yu Gothic UI", "Meiryo", system-ui, -apple-system, sans-serif',
  defaultRadius: 'md',
});
