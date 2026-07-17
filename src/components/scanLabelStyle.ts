export interface ScanLabelStyleOptions {
  color: string;
  fontSize: number;
  fontWeight: 500 | 600 | 700 | 800;
  fontFamily: string;
  uppercase: boolean;
}

export const defaultScanLabelStyle: ScanLabelStyleOptions = {
  color: '#171717',
  fontSize: 18,
  fontWeight: 700,
  fontFamily: 'Space Grotesk',
  uppercase: false,
};

// Get contrasting text color based on background
export const getContrastingTextColor = (bgColor: string): string => {
  // Remove '#' if present
  const hex = bgColor.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate luminance (standard formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#171717' : '#FFFFFF';
};
