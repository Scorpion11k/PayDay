import { createTheme, type Direction } from '@mui/material/styles';

// PayDay Theme - based on the design mockup
// Dark navy sidebar, light content area, blue accent colors

export function createAppTheme(direction: Direction = 'ltr') {
  return createTheme({
    direction,
    palette: {
      mode: 'light',
      primary: {
        main: '#1e3a5f', // Dark navy blue
        light: '#4a6fa5',
        dark: '#0d1f33',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#2196f3', // Bright blue accent
        light: '#64b5f6',
        dark: '#1976d2',
      },
      background: {
        default: '#f5f7fa',
        paper: '#ffffff',
      },
      text: {
        primary: '#1e2a3a',
        secondary: '#5a6a7a',
      },
      success: {
        main: '#4caf50',
        light: '#81c784',
      },
      divider: 'rgba(0, 0, 0, 0.08)',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2rem',
        fontWeight: 600,
        color: '#1e2a3a',
      },
      h2: {
        fontSize: '1.5rem',
        fontWeight: 600,
        color: '#1e2a3a',
      },
      h3: {
        fontSize: '1.25rem',
        fontWeight: 500,
      },
      body1: {
        fontSize: '0.938rem',
      },
      body2: {
        fontSize: '0.875rem',
        color: '#5a6a7a',
      },
      button: {
        textTransform: 'none',
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: '#1e2a3a',
            color: '#ffffff',
            // Remove border on the side adjacent to content
            ...(theme.direction === 'rtl' 
              ? { borderLeft: 'none', borderRight: 'none' }
              : { borderRight: 'none' }
            ),
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '2px 8px',
            '&.Mui-selected': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
              },
            },
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            color: 'inherit',
            minWidth: 40,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 16px',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.08)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: '#ffffff',
            color: '#1e2a3a',
            boxShadow: 'none',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
          },
        },
      },
    },
  });
}

// Default theme for backwards compatibility
const theme = createAppTheme('ltr');

export default theme;
