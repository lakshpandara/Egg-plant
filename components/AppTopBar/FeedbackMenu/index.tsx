import React, { useRef, useState } from "react";
import { HelpOutline } from "@material-ui/icons";
import {
  IconButton,
  makeStyles,
  Popover,
  PopoverOrigin,
} from "@material-ui/core";
import { Page } from "./Page";

const useStyles = makeStyles({
  root: { position: "relative" },
  popover: { marginTop: "25px" },
});
const anchorOrigin: PopoverOrigin = {
  vertical: "bottom",
  horizontal: "right",
};
const transformOrigin: PopoverOrigin = {
  vertical: "top",
  horizontal: "right",
};

export function FeedbackMenu() {
  const C = useStyles();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const handleClose = () => setOpen(false);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={() => setOpen(true)}
        className={C.root}
        ref={ref}
      >
        <HelpOutline />
      </IconButton>
      <Popover
        open={open}
        onClose={handleClose}
        anchorEl={ref.current}
        anchorOrigin={anchorOrigin}
        transformOrigin={transformOrigin}
        className={C.popover}
      >
        <Page onClose={handleClose} />
      </Popover>
    </>
  );
}
