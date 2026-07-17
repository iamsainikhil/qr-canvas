export interface LogoStyleOptions {
  badgeSize: number;
  padding: number;
  cornerRadius: number;
  backgroundColor: string;
}

export const defaultLogoStyleOptions: LogoStyleOptions = {
  badgeSize: 28,
  padding: 10,
  cornerRadius: 12,
  backgroundColor: '#FFFFFF',
};

export const resolveLogoStyleOptions = (
  options?: Partial<LogoStyleOptions> | null,
): LogoStyleOptions => ({
  badgeSize: options?.badgeSize ?? defaultLogoStyleOptions.badgeSize,
  padding: options?.padding ?? defaultLogoStyleOptions.padding,
  cornerRadius: options?.cornerRadius ?? defaultLogoStyleOptions.cornerRadius,
  backgroundColor: options?.backgroundColor ?? defaultLogoStyleOptions.backgroundColor,
});