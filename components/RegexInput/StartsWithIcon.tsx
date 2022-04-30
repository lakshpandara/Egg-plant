import React from "react";
import { SvgIcon } from "@material-ui/core";

type StartsWithIconPropType = {
  htmlColor: string;
};

export default function StartsWithIcon(props: StartsWithIconPropType) {
  return (
    <SvgIcon x="0px" y="0px" viewBox="-14 0 48 30" fontSize="large" {...props}>
      <svg>
        <g>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M26.8934 0C26.369 0 25.9439 0.425078 25.9439 0.949439V4.01957L23.285 2.48445C22.8309 2.22227 22.2503 2.37786 21.9881 2.83197C21.7259 3.28608 21.8815 3.86675 22.3356 4.12893L24.9945 5.66408L22.3356 7.19934C21.8815 7.46153 21.7259 8.0422 21.9881 8.49631C22.2503 8.95041 22.831 9.10598 23.2851 8.84379L25.9439 7.30858V10.379C25.9439 10.9034 26.369 11.3284 26.8934 11.3284C27.4177 11.3284 27.8428 10.9034 27.8428 10.379V7.30853L30.5018 8.84371C30.9559 9.10589 31.5366 8.9503 31.7988 8.49619C32.061 8.04208 31.9054 7.46141 31.4513 7.19923L28.7923 5.66408L31.4512 4.12903C31.9054 3.86687 32.061 3.2862 31.7988 2.83209C31.5366 2.37797 30.956 2.22236 30.5019 2.48453L27.8428 4.01963V0.949439C27.8428 0.425078 27.4177 0 26.8934 0Z"
          />
          <path d="M14.4635 9.99804C14.484 10.7654 14.5761 11.2565 14.7398 11.4714C14.8933 11.676 15.2002 11.7784 15.6607 11.7784C16.0188 11.7784 16.2899 11.6863 16.4741 11.5021C16.648 11.3077 16.735 11.0263 16.735 10.658C16.735 10.658 16.7299 10.5812 16.7196 10.4278C16.7094 10.2641 16.7043 10.1004 16.7043 9.93664L16.5508 4.87194C16.5304 4.49337 16.428 4.22222 16.2439 4.05852C16.0597 3.88458 15.7732 3.79761 15.3844 3.79761H2.04734C1.65853 3.79761 1.37205 3.88458 1.18787 4.05852C1.0037 4.22222 0.906502 4.49337 0.89627 4.87194L0.727446 9.93664C0.727446 10.1208 0.722331 10.2948 0.712099 10.4585C0.701867 10.6222 0.696751 10.6887 0.696751 10.6887C0.696751 11.057 0.793953 11.3333 0.988355 11.5174C1.18276 11.6914 1.47436 11.7784 1.86317 11.7784C2.27244 11.7784 2.55381 11.676 2.70729 11.4714C2.86076 11.2565 2.94773 10.7654 2.96819 9.99804L3.12167 6.00766H7.52643V19.8358H4.56434C4.13461 19.8358 3.82254 19.9228 3.62814 20.0968C3.43374 20.2605 3.33654 20.5265 3.33654 20.8948C3.33654 21.2529 3.42862 21.5292 3.61279 21.7236C3.79696 21.9078 4.06299 21.9999 4.41087 21.9999H13.0209C13.3687 21.9999 13.6348 21.9078 13.8189 21.7236C14.0031 21.5292 14.0952 21.2529 14.0952 20.8948C14.0952 20.5163 13.998 20.2451 13.8036 20.0814C13.599 19.9177 13.2562 19.8358 12.7753 19.8358H9.90531V6.00766H14.3101L14.4635 9.99804Z" />
        </g>
      </svg>
    </SvgIcon>
  );
}
