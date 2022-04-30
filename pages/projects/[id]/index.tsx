import * as React from "react";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import EditIcon from "@material-ui/icons/Edit";
import Chip from "@material-ui/core/Chip";
import BlurLinearIcon from "@material-ui/icons/BlurLinear";
import classNames from "classnames";

import { authenticatedPage, requireParam } from "../../../lib/pageHelpers";
import {
  formatSearchEndpoint,
  getSearchEndpoint,
} from "../../../lib/searchendpoints";
import { ExposedSearchEndpoint } from "../../../lib/searchendpoints/types/ExposedSearchEndpoint";

import Link, { LinkButton } from "../../../components/common/Link";
import { useActiveProject } from "../../../components/Session";
import BreadcrumbsButtons from "../../../components/common/BreadcrumbsButtons";
import FlaskIcon from "../../../components/common/FlaskIcon";
import {
  getProject,
  getRecentProject,
  RecentProject,
} from "../../../lib/projects";
import ProjectJudgementsTable from "../../../components/projects/ProjectJudgementsTable";
import ProjectRulesetsTable from "../../../components/projects/ProjectRulesetsTable";

export const getServerSideProps = authenticatedPage(async (context) => {
  const id = requireParam(context, "id");
  const project = await getProject(context.user, id);
  if (!project) {
    return { notFound: true };
  }
  const recentProject = await getRecentProject(project, context.user);
  const searchEndpoint = await getSearchEndpoint(
    context.user,
    project.searchEndpointId
  );
  if (!searchEndpoint) {
    return { notFound: true };
  }

  return {
    props: {
      projectData: recentProject,
      searchEndpoint: formatSearchEndpoint(searchEndpoint),
    },
  };
});

type Props = {
  projectData: RecentProject;
  searchEndpoint: ExposedSearchEndpoint;
};

const useStyles = makeStyles((theme) => ({
  headerWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWrapper: {
    display: "flex",
    alignItems: "center",
  },
  activeChipRoot: {
    color: "white",
    backgroundColor: green[700],
    marginLeft: theme.spacing(3),
  },
  testbedButton: {
    marginRight: theme.spacing(1),
    [theme.breakpoints.up("sm")]: {
      marginRight: theme.spacing(3),
    },
  },
  noWrapBtn: {
    whiteSpace: "nowrap",
  },
  manageBtn: {
    width: 215,
  },
  detailsWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flexRow: {
    display: "flex",
    justifyContent: "start",
    [theme.breakpoints.up("md")]: {
      justifyContent: "end",
    },
  },
}));

export default function ViewProject({ projectData, searchEndpoint }: Props) {
  const classes = useStyles();
  const { project } = useActiveProject();

  return (
    <div>
      <BreadcrumbsButtons>
        <Link href="/">Home</Link>
        <Link href="/projects">Projects</Link>
        <Typography>{projectData.name}</Typography>
      </BreadcrumbsButtons>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} className={classes.titleWrapper}>
          <Typography variant="h4">Project: {projectData.name}</Typography>
          {projectData.id === project?.id && (
            <Chip
              color="primary"
              label="Active"
              classes={{
                root: classes.activeChipRoot,
              }}
            />
          )}
        </Grid>
        <Grid item xs={12} md={6} className={classes.flexRow}>
          <LinkButton
            className={classNames(classes.testbedButton, classes.noWrapBtn)}
            href="/testbed"
            size="large"
            variant="contained"
            color="primary"
            startIcon={<BlurLinearIcon />}
          >
            Open Testbed
          </LinkButton>
          <LinkButton
            className={classes.noWrapBtn}
            href={`/${projectData.id}/lab`}
            size="large"
            variant="contained"
            color="primary"
            startIcon={<FlaskIcon />}
          >
            Go To Lab
          </LinkButton>
        </Grid>
        <Grid item xs={12}>
          <Grid container spacing={3}>
            <Grid item xs={6} sm={4}>
              <Typography variant="overline">Name</Typography>
              <Typography variant="h5">{projectData.name}</Typography>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Typography variant="overline">Search Endpoint</Typography>
              <Typography variant="h5">{searchEndpoint.name}</Typography>
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={12} className={classes.detailsWrapper}>
          <Typography variant="h6">Judgements</Typography>
          <LinkButton
            className={classes.manageBtn}
            href={`/judgements`}
            variant="outlined"
            startIcon={<EditIcon />}
          >
            Manage Judgements
          </LinkButton>
        </Grid>
        <Grid item xs={12}>
          <ProjectJudgementsTable judgements={projectData.latestJudgements} />
        </Grid>
        <Grid item xs={12} className={classes.detailsWrapper}>
          <Typography variant="h6">Rulesets</Typography>
          <LinkButton
            className={classes.manageBtn}
            href={`/rulesets`}
            variant="outlined"
            startIcon={<EditIcon />}
          >
            Manage Rulesets
          </LinkButton>
        </Grid>
        <Grid item xs={12}>
          <ProjectRulesetsTable rulesets={projectData.latestRulesets} />
        </Grid>
      </Grid>
    </div>
  );
}
