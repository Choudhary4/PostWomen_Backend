const themeService = require('./services/themeService');

// Test theme service
console.log('Testing Theme Service...\n');

// Test getting light theme
const lightTheme = themeService.getTheme('light');
console.log('Light theme:', lightTheme ? lightTheme.name : 'Not found');

// Test CSS generation
const css = themeService.generateCSSVariables('light');
console.log('\nGenerated CSS for light theme:');
console.log(css.substring(0, 500) + '...');

// Test getting active theme for default user
const activeTheme = themeService.getActiveTheme('default');
console.log('\nActive theme for default user:', activeTheme ? activeTheme.name : 'None');

// Test user preferences
const preferences = themeService.getUserPreferences('default');
console.log('\nDefault user preferences:', preferences);