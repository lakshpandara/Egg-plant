import React from "react";
import { useRouter } from "next/router";
import {
  Grid,
  Box,
  Button,
  Typography,
  Tooltip,
  makeStyles,
} from "@material-ui/core";

import { apiRequest } from "../../lib/api";
import { ExposedQueryTemplate } from "../../lib/querytemplates";
import { ExposedSearchConfiguration } from "../../lib/searchconfigurations";
import ExecutionModal from "./ExecutionModal";
import ExecutionList from "./ExecutionList";
import PhraseScore from "./PhraseScore";
import BasicModal from "../common/BasicModal";
import { useLabContext } from "../../utils/react/hooks/useLabContext";

const percentilesLabel: Record<string, string> = {
  tookP50: "p50",
  tookP95: "p95",
  tookP99: "p99",
};

const useStyles = makeStyles((theme) => ({
  latency: {
    color: theme.palette.primary.main,
    borderBottom: "2px dotted #ccc",
  },
  scoreBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    margin: theme.spacing(0, 1),
  },
}));

type Props = {
  templates: ExposedQueryTemplate[];
  activeSearchConfig: ExposedSearchConfiguration;
  onSelected: (id: string) => void;
};

const getExecutionTime = (date: Date | string): string => {
  const dateDate = new Date(date).toLocaleDateString("en-US");
  const dateTime = new Date(date).toLocaleTimeString("en-US");
  return `${dateDate} ${dateTime}`;
};

export default function ExecutionSummary({
  templates,
  activeSearchConfig,
  onSelected,
}: Props) {
  const classes = useStyles();
  const router = useRouter();
  const { currentExecution, searchConfiguration } = useLabContext();
  const [modalOpen, setModalOpen] = React.useState(false);

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleSetAsActive = async () => {
    await apiRequest("/api/projects/update", {
      id: router.query.projectId,
      activeSearchConfigurationId: searchConfiguration?.id,
    });
    router.replace(router.asPath);
  };

  const executionTime =
    currentExecution && getExecutionTime(currentExecution.createdAt);

  return (
    <Box>
      <Typography variant="h5">Search Configurations</Typography>
      <Box mt={2} mb={3}>
        <ExecutionList
          activeSearchConfig={activeSearchConfig}
          onSelected={onSelected}
        />
      </Box>
      {currentExecution && (
        <>
          <Typography variant="h5">Latest Execution</Typography>
          <Box my={2}>
            <Grid container>
              <Grid item className={classes.scoreBox}>
                <PhraseScore
                  score={Math.round(currentExecution.combinedScore * 100)}
                  tooltip="Sierra score"
                />
                <Box mt={0.5}>
                  <Typography variant="subtitle2">Sierra score</Typography>
                </Box>
              </Grid>
              {Object.entries(
                currentExecution?.allScores as Record<string, number>
              ).map(([key, value]) => (
                <Grid key={key} item className={classes.scoreBox}>
                  <PhraseScore
                    score={Math.round(value * 100)}
                    tooltip={`${key} score`}
                  />
                  <Box mt={0.5}>
                    <Typography variant="subtitle2">{key} score</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
          <Box>
            <Typography>
              {"Executed on "}
              <strong>{executionTime}</strong>
            </Typography>
          </Box>
          <Box mb={4}>
            <Typography>
              {"Latency "}
              <Tooltip
                title={
                  <React.Fragment>
                    {Object.entries(
                      currentExecution.meta as Record<string, number>
                    ).map(([key, value]) => (
                      <div key={key}>
                        <strong>{percentilesLabel[key] || key}</strong>
                        {` ${Math.round(value)}ms`}
                      </div>
                    ))}
                  </React.Fragment>
                }
              >
                <span className={classes.latency}>
                  {(currentExecution.meta as Record<string, number>)["tookP50"]}
                  ms
                </span>
              </Tooltip>
              {" avg"}
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item>
              <Button variant="outlined" onClick={handleOpenModal}>
                View details
              </Button>
            </Grid>
            {searchConfiguration?.id !== activeSearchConfig.id && (
              <Grid item>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleSetAsActive}
                >
                  Set as active
                </Button>
              </Grid>
            )}
          </Grid>
          <BasicModal open={modalOpen} onClose={handleCloseModal}>
            <ExecutionModal templates={templates} />
          </BasicModal>
        </>
      )}
    </Box>
  );
}
