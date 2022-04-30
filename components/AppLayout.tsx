import React from "react";
import {
  Box,
  Typography,
  Container,
  CssBaseline,
  makeStyles,
} from "@material-ui/core";

import Link from "./common/Link";
import AppTopBar from "./AppTopBar/AppTopBar";
import { useSession } from "../components/Session";
import AppTopBarSpacer from "./common/AppTopBarSpacer";

function Copyright() {
  return (
    <Typography variant="body2" color="textSecondary" align="center">
      {"Copyright © "}
      <Link color="inherit" href="https://bigdataboutique.com/">
        BigData Boutique
      </Link>{" "}
      {new Date().getFullYear()}
      {"."}
    </Typography>
  );
}

export const LayoutContext = React.createContext({
  sidebarRef: React.createRef<HTMLDivElement | null>(),
});

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    flexGrow: 1,
    minHeight: "100vh",
  },
  content: {
    display: "flex",
    alignItems: "stretch",
    width: "100%",
    height: "100%",
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
}));

type AppLayoutProps = {
  children?: React.ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const classes = useStyles();
  const session = useSession();
  const sidebarRef = React.useRef<HTMLDivElement | null>(null);

  if (!session.session.user) {
    return <>{children}</>;
  }

  return (
    <LayoutContext.Provider value={{ sidebarRef }}>
      <div className={classes.root}>
        <CssBaseline />
        <AppTopBar />
        <main className={classes.main}>
          <AppTopBarSpacer />
          <div className={classes.content}>
            <div ref={sidebarRef}></div>
            <Container maxWidth="lg" className={classes.container}>
              {children}
              <Box py={4}>
                <Copyright />
              </Box>
            </Container>
          </div>
        </main>
      </div>
    </LayoutContext.Provider>
  );
}
