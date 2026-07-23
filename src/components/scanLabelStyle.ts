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


