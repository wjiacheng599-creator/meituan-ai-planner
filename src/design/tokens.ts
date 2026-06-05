export interface ColorTokens {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  danger: string;
  dangerForeground: string;
  info: string;
  infoForeground: string;
  background: string;
  surface: string;
  card: string;
  cardSoft: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderStrong: string;
  brand: string;
  brandStrong: string;
  brandSoft: string;
}

export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
}

export interface RadiusTokens {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface ShadowTokens {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface FontTokens {
  sans: string;
  mono: string;
  sizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  weights: {
    normal: string;
    medium: string;
    semibold: string;
    bold: string;
  };
}

export interface Theme {
  colors: ColorTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  shadow: ShadowTokens;
  font: FontTokens;
}

const spacing: SpacingTokens = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
};

const radius: RadiusTokens = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '24px',
  full: '9999px',
};

const shadowLight: ShadowTokens = {
  sm: '0 2px 8px rgba(21, 24, 33, 0.04)',
  md: '0 8px 24px rgba(21, 24, 33, 0.05)',
  lg: '0 12px 36px rgba(21, 24, 33, 0.06)',
  xl: '0 16px 44px rgba(21, 24, 33, 0.1)',
};

const shadowDark: ShadowTokens = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.18)',
  md: '0 8px 24px rgba(0, 0, 0, 0.22)',
  lg: '0 12px 36px rgba(0, 0, 0, 0.28)',
  xl: '0 16px 44px rgba(0, 0, 0, 0.35)',
};

const font: FontTokens = {
  sans: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  mono: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", ui-monospace, monospace',
  sizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

export const lightTokens: Theme = {
  colors: {
    primary: '#ffd84d',
    primaryForeground: '#3b2b00',
    secondary: '#6b7d98',
    secondaryForeground: '#ffffff',
    accent: '#c94b86',
    accentForeground: '#ffffff',
    success: '#1fbf75',
    successForeground: '#ffffff',
    warning: '#ff8a3d',
    warningForeground: '#ffffff',
    danger: '#ef5b74',
    dangerForeground: '#ffffff',
    info: '#4e8ef7',
    infoForeground: '#ffffff',
    background: '#f6f7fb',
    surface: 'rgba(255, 255, 255, 0.82)',
    card: '#ffffff',
    cardSoft: '#f8f9fd',
    text: '#141821',
    textSecondary: '#606978',
    textTertiary: '#8b94a3',
    border: '#e7ebf3',
    borderStrong: '#d9e0ec',
    brand: '#ffd84d',
    brandStrong: '#ffc83a',
    brandSoft: '#fff4bf',
  },
  spacing,
  radius,
  shadow: shadowLight,
  font,
};

export const darkTokens: Theme = {
  colors: {
    primary: '#ffd84d',
    primaryForeground: '#3b2b00',
    secondary: '#8ea3bb',
    secondaryForeground: '#111318',
    accent: '#e47ea8',
    accentForeground: '#1a0d14',
    success: '#34d399',
    successForeground: '#0a1a14',
    warning: '#ffa366',
    warningForeground: '#1a0e06',
    danger: '#f4728b',
    dangerForeground: '#1a0a0e',
    info: '#6aa6ff',
    infoForeground: '#0a1420',
    background: '#0f1117',
    surface: 'rgba(24, 27, 36, 0.88)',
    card: '#1a1d27',
    cardSoft: '#21242f',
    text: '#e8eaf0',
    textSecondary: '#9399a8',
    textTertiary: '#6b7084',
    border: '#2a2e3a',
    borderStrong: '#373b4a',
    brand: '#ffd84d',
    brandStrong: '#ffc83a',
    brandSoft: '#3d3100',
  },
  spacing,
  radius,
  shadow: shadowDark,
  font,
};

export function tokensToCSS(theme: Theme): string {
  const { colors, spacing: sp, radius: rd, shadow: sh, font: ft } = theme;

  const vars: string[] = [];

  vars.push(`  --color-primary: ${colors.primary};`);
  vars.push(`  --color-primary-foreground: ${colors.primaryForeground};`);
  vars.push(`  --color-secondary: ${colors.secondary};`);
  vars.push(`  --color-secondary-foreground: ${colors.secondaryForeground};`);
  vars.push(`  --color-accent: ${colors.accent};`);
  vars.push(`  --color-accent-foreground: ${colors.accentForeground};`);
  vars.push(`  --color-success: ${colors.success};`);
  vars.push(`  --color-success-foreground: ${colors.successForeground};`);
  vars.push(`  --color-warning: ${colors.warning};`);
  vars.push(`  --color-warning-foreground: ${colors.warningForeground};`);
  vars.push(`  --color-danger: ${colors.danger};`);
  vars.push(`  --color-danger-foreground: ${colors.dangerForeground};`);
  vars.push(`  --color-info: ${colors.info};`);
  vars.push(`  --color-info-foreground: ${colors.infoForeground};`);
  vars.push(`  --color-background: ${colors.background};`);
  vars.push(`  --color-surface: ${colors.surface};`);
  vars.push(`  --color-card: ${colors.card};`);
  vars.push(`  --color-card-soft: ${colors.cardSoft};`);
  vars.push(`  --color-text: ${colors.text};`);
  vars.push(`  --color-text-secondary: ${colors.textSecondary};`);
  vars.push(`  --color-text-tertiary: ${colors.textTertiary};`);
  vars.push(`  --color-border: ${colors.border};`);
  vars.push(`  --color-border-strong: ${colors.borderStrong};`);
  vars.push(`  --color-brand: ${colors.brand};`);
  vars.push(`  --color-brand-strong: ${colors.brandStrong};`);
  vars.push(`  --color-brand-soft: ${colors.brandSoft};`);

  vars.push(`  --spacing-xs: ${sp.xs};`);
  vars.push(`  --spacing-sm: ${sp.sm};`);
  vars.push(`  --spacing-md: ${sp.md};`);
  vars.push(`  --spacing-lg: ${sp.lg};`);
  vars.push(`  --spacing-xl: ${sp.xl};`);
  vars.push(`  --spacing-2xl: ${sp['2xl']};`);
  vars.push(`  --spacing-3xl: ${sp['3xl']};`);

  vars.push(`  --radius-sm: ${rd.sm};`);
  vars.push(`  --radius-md: ${rd.md};`);
  vars.push(`  --radius-lg: ${rd.lg};`);
  vars.push(`  --radius-xl: ${rd.xl};`);
  vars.push(`  --radius-full: ${rd.full};`);

  vars.push(`  --shadow-sm: ${sh.sm};`);
  vars.push(`  --shadow-md: ${sh.md};`);
  vars.push(`  --shadow-lg: ${sh.lg};`);
  vars.push(`  --shadow-xl: ${sh.xl};`);

  vars.push(`  --font-sans: ${ft.sans};`);
  vars.push(`  --font-mono: ${ft.mono};`);
  vars.push(`  --font-size-xs: ${ft.sizes.xs};`);
  vars.push(`  --font-size-sm: ${ft.sizes.sm};`);
  vars.push(`  --font-size-base: ${ft.sizes.base};`);
  vars.push(`  --font-size-lg: ${ft.sizes.lg};`);
  vars.push(`  --font-size-xl: ${ft.sizes.xl};`);
  vars.push(`  --font-size-2xl: ${ft.sizes['2xl']};`);
  vars.push(`  --font-size-3xl: ${ft.sizes['3xl']};`);
  vars.push(`  --font-weight-normal: ${ft.weights.normal};`);
  vars.push(`  --font-weight-medium: ${ft.weights.medium};`);
  vars.push(`  --font-weight-semibold: ${ft.weights.semibold};`);
  vars.push(`  --font-weight-bold: ${ft.weights.bold};`);

  return vars.join('\n');
}

export function applyTheme(theme: Theme): void {
  const css = tokensToCSS(theme);
  const root = document.documentElement;

  css.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^--([^:]+):\s*(.+);$/);
    if (match) {
      root.style.setProperty(`--${match[1]}`, match[2]);
    }
  });
}

export function getCurrentTheme(): Theme | null {
  const root = document.documentElement;
  const bg = root.style.getPropertyValue('--color-background').trim();
  if (bg === lightTokens.colors.background) return lightTokens;
  if (bg === darkTokens.colors.background) return darkTokens;
  return null;
}
