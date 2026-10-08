declare module "react-qr-code" {
  import * as React from "react";
  interface QRCodeProps {
    value: string;
    size?: number;
    bgColor?: string;
    fgColor?: string;
    level?: "L" | "M" | "Q" | "H";
    className?: string;
    style?: React.CSSProperties;
    title?: string;
  }
  const QRCode: React.FC<QRCodeProps>;
  export default QRCode;
}
