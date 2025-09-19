class ThemeService {
  constructor() {
    this.themes = new Map();
    this.userPreferences = new Map();
    this.defaultThemes = this.createDefaultThemes();
    
    // Initialize with default themes
    this.defaultThemes.forEach(theme => {
      this.themes.set(theme.id, theme);
    });
  }

  // Create default themes
  createDefaultThemes() {
    return [
      {
        id: 'light',
        name: 'Light Theme',
        type: 'light',
        description: 'Clean and bright interface for daytime use',
        author: 'PostWomen',
        version: '1.0.0',
        isDefault: true,
        colors: {
          // Primary colors
          primary: '#007bff',
          primaryHover: '#0056b3',
          primaryActive: '#004085',
          primaryLight: '#e3f2fd',
          
          // Secondary colors
          secondary: '#6c757d',
          secondaryHover: '#5a6268',
          secondaryLight: '#f8f9fa',
          
          // Background colors
          background: '#ffffff',
          backgroundSecondary: '#f8f9fa',
          backgroundTertiary: '#e9ecef',
          
          // Surface colors
          surface: '#ffffff',
          surfaceHover: '#f8f9fa',
          surfaceActive: '#e9ecef',
          
          // Text colors
          textPrimary: '#212529',
          textSecondary: '#6c757d',
          textMuted: '#adb5bd',
          textInverse: '#ffffff',
          
          // Border colors
          border: '#dee2e6',
          borderLight: '#f8f9fa',
          borderDark: '#adb5bd',
          
          // Status colors
          success: '#28a745',
          successLight: '#d4edda',
          warning: '#ffc107',
          warningLight: '#fff3cd',
          error: '#dc3545',
          errorLight: '#f8d7da',
          info: '#17a2b8',
          infoLight: '#d1ecf1',
          
          // Special colors
          shadow: 'rgba(0, 0, 0, 0.1)',
          shadowDark: 'rgba(0, 0, 0, 0.2)',
          overlay: 'rgba(0, 0, 0, 0.5)',
          
          // Code colors
          codeBackground: '#f8f9fa',
          codeBorder: '#e9ecef',
          codeText: '#495057'
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSizeBase: '14px',
          fontSizeSmall: '12px',
          fontSizeLarge: '16px',
          fontSizeHeading: '18px',
          fontWeightNormal: '400',
          fontWeightBold: '600',
          lineHeight: '1.5'
        },
        spacing: {
          xs: '4px',
          sm: '8px',
          md: '16px',
          lg: '24px',
          xl: '32px',
          xxl: '48px'
        },
        borderRadius: {
          small: '4px',
          medium: '6px',
          large: '8px',
          round: '50%'
        },
        animation: {
          duration: '0.2s',
          easing: 'ease-in-out'
        }
      },
      {
        id: 'dark',
        name: 'Dark Theme',
        type: 'dark',
        description: 'Easy on the eyes for nighttime coding sessions',
        author: 'PostWomen',
        version: '1.0.0',
        isDefault: true,
        colors: {
          // Primary colors
          primary: '#4da6ff',
          primaryHover: '#0080ff',
          primaryActive: '#0066cc',
          primaryLight: '#1a365d',
          
          // Secondary colors
          secondary: '#718096',
          secondaryHover: '#a0aec0',
          secondaryLight: '#2d3748',
          
          // Background colors
          background: '#1a1a1a',
          backgroundSecondary: '#2d2d2d',
          backgroundTertiary: '#3d3d3d',
          
          // Surface colors
          surface: '#2d2d2d',
          surfaceHover: '#3d3d3d',
          surfaceActive: '#4d4d4d',
          
          // Text colors
          textPrimary: '#e0e0e0',
          textSecondary: '#a0a0a0',
          textMuted: '#6c757d',
          textInverse: '#1a1a1a',
          
          // Border colors
          border: '#444444',
          borderLight: '#555555',
          borderDark: '#333333',
          
          // Status colors
          success: '#4caf50',
          successLight: '#1b5e20',
          warning: '#ff9800',
          warningLight: '#e65100',
          error: '#f44336',
          errorLight: '#c62828',
          info: '#2196f3',
          infoLight: '#0d47a1',
          
          // Special colors
          shadow: 'rgba(0, 0, 0, 0.3)',
          shadowDark: 'rgba(0, 0, 0, 0.5)',
          overlay: 'rgba(0, 0, 0, 0.7)',
          
          // Code colors
          codeBackground: '#3d3d3d',
          codeBorder: '#555555',
          codeText: '#e0e0e0'
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSizeBase: '14px',
          fontSizeSmall: '12px',
          fontSizeLarge: '16px',
          fontSizeHeading: '18px',
          fontWeightNormal: '400',
          fontWeightBold: '600',
          lineHeight: '1.5'
        },
        spacing: {
          xs: '4px',
          sm: '8px',
          md: '16px',
          lg: '24px',
          xl: '32px',
          xxl: '48px'
        },
        borderRadius: {
          small: '4px',
          medium: '6px',
          large: '8px',
          round: '50%'
        },
        animation: {
          duration: '0.2s',
          easing: 'ease-in-out'
        }
      },
      {
        id: 'blue',
        name: 'Ocean Blue',
        type: 'light',
        description: 'Cool blue tones for a calming experience',
        author: 'PostWomen',
        version: '1.0.0',
        isDefault: true,
        colors: {
          primary: '#1e88e5',
          primaryHover: '#1565c0',
          primaryActive: '#0d47a1',
          primaryLight: '#e3f2fd',
          secondary: '#546e7a',
          secondaryHover: '#455a64',
          secondaryLight: '#eceff1',
          background: '#fafafa',
          backgroundSecondary: '#f5f5f5',
          backgroundTertiary: '#eeeeee',
          surface: '#ffffff',
          surfaceHover: '#f5f5f5',
          surfaceActive: '#eeeeee',
          textPrimary: '#263238',
          textSecondary: '#546e7a',
          textMuted: '#90a4ae',
          textInverse: '#ffffff',
          border: '#cfd8dc',
          borderLight: '#eceff1',
          borderDark: '#90a4ae',
          success: '#2e7d32',
          successLight: '#e8f5e8',
          warning: '#f57c00',
          warningLight: '#fff3e0',
          error: '#d32f2f',
          errorLight: '#ffebee',
          info: '#1976d2',
          infoLight: '#e3f2fd',
          shadow: 'rgba(0, 0, 0, 0.08)',
          shadowDark: 'rgba(0, 0, 0, 0.16)',
          overlay: 'rgba(0, 0, 0, 0.4)',
          codeBackground: '#f5f5f5',
          codeBorder: '#e0e0e0',
          codeText: '#424242'
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSizeBase: '14px',
          fontSizeSmall: '12px',
          fontSizeLarge: '16px',
          fontSizeHeading: '18px',
          fontWeightNormal: '400',
          fontWeightBold: '600',
          lineHeight: '1.5'
        },
        spacing: {
          xs: '4px',
          sm: '8px',
          md: '16px',
          lg: '24px',
          xl: '32px',
          xxl: '48px'
        },
        borderRadius: {
          small: '4px',
          medium: '6px',
          large: '8px',
          round: '50%'
        },
        animation: {
          duration: '0.2s',
          easing: 'ease-in-out'
        }
      },
      {
        id: 'green',
        name: 'Forest Green',
        type: 'light',
        description: 'Natural green tones for a refreshing interface',
        author: 'PostWomen',
        version: '1.0.0',
        isDefault: true,
        colors: {
          primary: '#2e7d32',
          primaryHover: '#1b5e20',
          primaryActive: '#0d5302',
          primaryLight: '#e8f5e8',
          secondary: '#5d4037',
          secondaryHover: '#3e2723',
          secondaryLight: '#efebe9',
          background: '#fafafa',
          backgroundSecondary: '#f1f8e9',
          backgroundTertiary: '#e8f5e8',
          surface: '#ffffff',
          surfaceHover: '#f1f8e9',
          surfaceActive: '#e8f5e8',
          textPrimary: '#1b5e20',
          textSecondary: '#388e3c',
          textMuted: '#689f38',
          textInverse: '#ffffff',
          border: '#c8e6c9',
          borderLight: '#e8f5e8',
          borderDark: '#81c784',
          success: '#2e7d32',
          successLight: '#e8f5e8',
          warning: '#f57c00',
          warningLight: '#fff3e0',
          error: '#d32f2f',
          errorLight: '#ffebee',
          info: '#1976d2',
          infoLight: '#e3f2fd',
          shadow: 'rgba(0, 0, 0, 0.08)',
          shadowDark: 'rgba(0, 0, 0, 0.16)',
          overlay: 'rgba(0, 0, 0, 0.4)',
          codeBackground: '#f1f8e9',
          codeBorder: '#c8e6c9',
          codeText: '#2e7d32'
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSizeBase: '14px',
          fontSizeSmall: '12px',
          fontSizeLarge: '16px',
          fontSizeHeading: '18px',
          fontWeightNormal: '400',
          fontWeightBold: '600',
          lineHeight: '1.5'
        },
        spacing: {
          xs: '4px',
          sm: '8px',
          md: '16px',
          lg: '24px',
          xl: '32px',
          xxl: '48px'
        },
        borderRadius: {
          small: '4px',
          medium: '6px',
          large: '8px',
          round: '50%'
        },
        animation: {
          duration: '0.2s',
          easing: 'ease-in-out'
        }
      },
      {
        id: 'purple',
        name: 'Royal Purple',
        type: 'dark',
        description: 'Elegant purple theme with dark accents',
        author: 'PostWomen',
        version: '1.0.0',
        isDefault: true,
        colors: {
          primary: '#9c27b0',
          primaryHover: '#7b1fa2',
          primaryActive: '#4a148c',
          primaryLight: '#3a1a4a',
          secondary: '#6a4c93',
          secondaryHover: '#8b5a96',
          secondaryLight: '#2a1a3a',
          background: '#1a0d26',
          backgroundSecondary: '#2a1a3a',
          backgroundTertiary: '#3a2a4a',
          surface: '#2a1a3a',
          surfaceHover: '#3a2a4a',
          surfaceActive: '#4a3a5a',
          textPrimary: '#e1bee7',
          textSecondary: '#ce93d8',
          textMuted: '#ba68c8',
          textInverse: '#1a0d26',
          border: '#4a3a5a',
          borderLight: '#5a4a6a',
          borderDark: '#3a2a4a',
          success: '#4caf50',
          successLight: '#1b4332',
          warning: '#ff9800',
          warningLight: '#3d2914',
          error: '#f44336',
          errorLight: '#3d1a1a',
          info: '#2196f3',
          infoLight: '#1a2d3d',
          shadow: 'rgba(0, 0, 0, 0.4)',
          shadowDark: 'rgba(0, 0, 0, 0.6)',
          overlay: 'rgba(0, 0, 0, 0.8)',
          codeBackground: '#3a2a4a',
          codeBorder: '#5a4a6a',
          codeText: '#e1bee7'
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSizeBase: '14px',
          fontSizeSmall: '12px',
          fontSizeLarge: '16px',
          fontSizeHeading: '18px',
          fontWeightNormal: '400',
          fontWeightBold: '600',
          lineHeight: '1.5'
        },
        spacing: {
          xs: '4px',
          sm: '8px',
          md: '16px',
          lg: '24px',
          xl: '32px',
          xxl: '48px'
        },
        borderRadius: {
          small: '4px',
          medium: '6px',
          large: '8px',
          round: '50%'
        },
        animation: {
          duration: '0.2s',
          easing: 'ease-in-out'
        }
      }
    ];
  }

  // Get all themes
  getAllThemes() {
    return Array.from(this.themes.values());
  }

  // Get theme by ID
  getTheme(id) {
    return this.themes.get(id);
  }

  // Create custom theme
  createTheme(themeData) {
    const theme = {
      id: this.generateId(),
      name: themeData.name || 'Custom Theme',
      type: themeData.type || 'light',
      description: themeData.description || '',
      author: themeData.author || 'User',
      version: themeData.version || '1.0.0',
      isDefault: false,
      isCustom: true,
      createdAt: new Date().toISOString(),
      ...themeData
    };

    this.themes.set(theme.id, theme);
    return theme;
  }

  // Update theme
  updateTheme(id, updates) {
    const theme = this.themes.get(id);
    if (!theme) return null;

    // Don't allow updating default themes
    if (theme.isDefault) {
      throw new Error('Cannot modify default themes');
    }

    const updatedTheme = {
      ...theme,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.themes.set(id, updatedTheme);
    return updatedTheme;
  }

  // Delete theme
  deleteTheme(id) {
    const theme = this.themes.get(id);
    if (!theme) return false;

    // Don't allow deleting default themes
    if (theme.isDefault) {
      throw new Error('Cannot delete default themes');
    }

    return this.themes.delete(id);
  }

  // Clone theme
  cloneTheme(id, newName) {
    const theme = this.themes.get(id);
    if (!theme) return null;

    const clonedTheme = {
      ...theme,
      id: this.generateId(),
      name: newName || `${theme.name} (Copy)`,
      isDefault: false,
      isCustom: true,
      clonedFrom: id,
      createdAt: new Date().toISOString()
    };

    this.themes.set(clonedTheme.id, clonedTheme);
    return clonedTheme;
  }

  // Get user preferences
  getUserPreferences(userId = 'default') {
    return this.userPreferences.get(userId) || {
      userId,
      activeTheme: 'light',
      autoTheme: false, // Auto switch based on system preference
      themeSchedule: null, // { light: '08:00', dark: '20:00' }
      customSettings: {},
      createdAt: new Date().toISOString()
    };
  }

  // Update user preferences
  updateUserPreferences(userId = 'default', preferences) {
    const current = this.getUserPreferences(userId);
    const updated = {
      ...current,
      ...preferences,
      updatedAt: new Date().toISOString()
    };

    this.userPreferences.set(userId, updated);
    return updated;
  }

  // Set active theme for user
  setActiveTheme(userId = 'default', themeId) {
    const theme = this.themes.get(themeId);
    if (!theme) {
      throw new Error('Theme not found');
    }

    return this.updateUserPreferences(userId, { activeTheme: themeId });
  }

  // Get active theme for user
  getActiveTheme(userId = 'default') {
    const preferences = this.getUserPreferences(userId);
    const theme = this.themes.get(preferences.activeTheme);
    
    if (!theme) {
      // Fallback to light theme if active theme not found
      return this.themes.get('light');
    }

    return theme;
  }

  // Generate CSS variables from theme
  generateCSSVariables(themeId) {
    const theme = this.themes.get(themeId);
    if (!theme) return '';

    let css = ':root {\n';

    // Colors
    if (theme.colors) {
      Object.entries(theme.colors).forEach(([key, value]) => {
        const cssVar = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        css += `  --color-${cssVar}: ${value};\n`;
      });
    }

    // Typography
    if (theme.typography) {
      Object.entries(theme.typography).forEach(([key, value]) => {
        const cssVar = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        css += `  --typography-${cssVar}: ${value};\n`;
      });
    }

    // Spacing
    if (theme.spacing) {
      Object.entries(theme.spacing).forEach(([key, value]) => {
        css += `  --spacing-${key}: ${value};\n`;
      });
    }

    // Border Radius
    if (theme.borderRadius) {
      Object.entries(theme.borderRadius).forEach(([key, value]) => {
        css += `  --border-radius-${key}: ${value};\n`;
      });
    }

    // Animation
    if (theme.animation) {
      Object.entries(theme.animation).forEach(([key, value]) => {
        css += `  --animation-${key}: ${value};\n`;
      });
    }

    css += '}\n';
    return css;
  }

  // Get theme statistics
  getThemeStatistics() {
    const totalThemes = this.themes.size;
    const defaultThemes = Array.from(this.themes.values()).filter(t => t.isDefault).length;
    const customThemes = totalThemes - defaultThemes;
    const lightThemes = Array.from(this.themes.values()).filter(t => t.type === 'light').length;
    const darkThemes = Array.from(this.themes.values()).filter(t => t.type === 'dark').length;
    
    const totalUsers = this.userPreferences.size;
    const themeUsage = {};
    
    Array.from(this.userPreferences.values()).forEach(pref => {
      themeUsage[pref.activeTheme] = (themeUsage[pref.activeTheme] || 0) + 1;
    });

    return {
      totalThemes,
      defaultThemes,
      customThemes,
      lightThemes,
      darkThemes,
      totalUsers,
      themeUsage
    };
  }

  // Export themes and preferences
  exportThemes() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      themes: Array.from(this.themes.values()).filter(t => !t.isDefault), // Only export custom themes
      userPreferences: Array.from(this.userPreferences.values())
    };
  }

  // Import themes and preferences
  importThemes(data) {
    try {
      let imported = 0;

      if (data.themes && Array.isArray(data.themes)) {
        data.themes.forEach(theme => {
          const newTheme = {
            ...theme,
            id: this.generateId(), // Generate new ID to avoid conflicts
            importedAt: new Date().toISOString()
          };
          this.themes.set(newTheme.id, newTheme);
          imported++;
        });
      }

      if (data.userPreferences && Array.isArray(data.userPreferences)) {
        data.userPreferences.forEach(pref => {
          this.userPreferences.set(pref.userId, {
            ...pref,
            importedAt: new Date().toISOString()
          });
        });
      }

      return { success: true, imported };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Validate theme data
  validateTheme(themeData) {
    const errors = [];

    if (!themeData.name || typeof themeData.name !== 'string') {
      errors.push('Theme name is required and must be a string');
    }

    if (!themeData.type || !['light', 'dark'].includes(themeData.type)) {
      errors.push('Theme type must be either "light" or "dark"');
    }

    if (themeData.colors && typeof themeData.colors !== 'object') {
      errors.push('Colors must be an object');
    }

    // Check required color properties
    const requiredColors = ['primary', 'background', 'textPrimary', 'border'];
    if (themeData.colors) {
      requiredColors.forEach(color => {
        if (!themeData.colors[color]) {
          errors.push(`Required color "${color}" is missing`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Clear all custom themes and preferences
  clearCustomData() {
    // Remove only custom themes
    for (const [id, theme] of this.themes.entries()) {
      if (!theme.isDefault) {
        this.themes.delete(id);
      }
    }

    // Clear user preferences
    this.userPreferences.clear();

    return { success: true };
  }

  // Reset to default themes
  resetToDefaults() {
    this.themes.clear();
    this.userPreferences.clear();
    
    // Re-add default themes
    this.defaultThemes.forEach(theme => {
      this.themes.set(theme.id, theme);
    });

    return { success: true };
  }
}

const themeService = new ThemeService();
export default themeService;